import { desktopCapturer, net } from 'electron'
import { supabase } from './supabase'

export class ScreenshotService {

    // Captures the primary screen
    public async captureScreen(): Promise<string> {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 }
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
