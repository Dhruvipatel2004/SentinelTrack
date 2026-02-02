import { desktopCapturer, net } from 'electron'
import { supabase } from './supabase'
import { GoogleGenerativeAI } from "@google/generative-ai";

export class ScreenshotService {
    private genAI: GoogleGenerativeAI | null = null;

    constructor() {
        const apiKey = import.meta.env.MAIN_VITE_GOOGLE_GEMINI_API_KEY || process.env.MAIN_VITE_GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    // Captures the primary screen
    public async captureScreen(): Promise<string> {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1280, height: 720 } // Reduced from 1920x1080 for better performance
            });

            // Prefer the primary display or the first one
            const primarySource = sources[0]; // Simple default for now

            if (primarySource) {
                return primarySource.thumbnail.toDataURL();
            }
            throw new Error('No screen sources found');
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            throw error;
        }
    }

    public async generateAIDescription(dataUrl: string): Promise<string> {
        try {
            if (!this.genAI) {
                const apiKey = import.meta.env.MAIN_VITE_GOOGLE_GEMINI_API_KEY ||
                    process.env.MAIN_VITE_GOOGLE_GEMINI_API_KEY ||
                    process.env.GOOGLE_GEMINI_API_KEY;

                if (!apiKey) {
                    console.warn('Gemini API Key missing, returning default description');
                    return 'Working on tasks';
                }
                this.genAI = new GoogleGenerativeAI(apiKey);
            }

            const model = this.genAI.getGenerativeModel({
                model: "gemini-2.5-flash"
            });

            // Ensure we only have the base64 string
            const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: "image/png"
                    }
                },
                "Analyze this screenshot and provide a very short, one-line description (short phrase) of what the user is doing. Example: 'Coding in VS Code'. Keep it under 10 words."
            ]);

            const response = await result.response;
            const text = response.text().trim();

            return text || 'Working on tasks';
        } catch (error: any) {
            // Log the specific error to help with further debugging
            console.error('AI Analysis failed:', error.message || error);

            // Handle 404 specifically in logs if it persists
            if (error.status === 404) {
                console.error('Check if "Generative Language API" is enabled in Google Cloud Console for project: gen-lang-client-0665339235');
            }

            return 'Working on tasks';
        }
    }

    public async uploadScreenshot(
        userId: string,
        dataUrl: string,
        description: string = '',
        projectId?: string,
        milestoneId?: string,
        taskId?: string,
        accessToken?: string,
        sessionId?: string
    ): Promise<boolean> {
        // ... existing code ...
        try {
            console.log('Uploading screenshot for user:', userId);

            if (accessToken) {
                console.log('ScreenshotService: key provided, updating session...');
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: ''
                });
                if (error) console.error('ScreenshotService: setSession Error:', error);
            }

            // Convert DataURL to Buffer
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');

            const timestamp = Date.now();
            const filename = `${userId}/${timestamp}.png`;

            // DEBUG: Check Auth Session
            const { data: sessionData } = await supabase.auth.getSession();
            // console.error('ScreenshotService: Current Auth User:', sessionData.session?.user?.id || 'NOT AUTHENTICATED');

            // 1. Upload to Storage
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('screenshots')
                .upload(filename, buffer, {
                    contentType: 'image/png',
                    upsert: false
                });

            if (uploadError) {
                console.error('Supabase Storage Upload Error:', uploadError);
                throw uploadError;
            }

            // 2. Insert Record into DB
            const { data: signedData, error: signedError } = await supabase
                .storage
                .from('screenshots')
                .createSignedUrl(filename, 365 * 24 * 60 * 60);
            if (signedError) {
                console.error('Error creating signed URL:', signedError);
                throw signedError;
            }

            const publicUrl = signedData.signedUrl;

            const { error: dbError } = await supabase
                .from('screenshots')
                .insert({
                    user_id: userId,
                    image_path: filename,
                    image_url: publicUrl,
                    work_description: description,
                    project_id: projectId,
                    milestone_id: milestoneId,
                    task_id: taskId,
                    session_id: sessionId,
                    captured_at: new Date().toISOString()
                });

            if (dbError) {
                console.error('Supabase DB Insert Error:', dbError);
                // Optional: Try to delete the uploaded image if DB fails to keep consistency
                throw dbError;
            }

            console.log('Screenshot uploaded successfully:', filename);
            return true;
        } catch (error) {
            console.error('Screenshot upload service failed:', error);
            return false;
        }
    }
}

export const screenshotService = new ScreenshotService();
