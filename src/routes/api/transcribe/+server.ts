
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
    try {
        if (!OPENAI_API_KEY) {
            return json({ error: 'Server misconfiguration: Missing OPENAI_API_KEY' }, { status: 500 });
        }

        const formData = await request.formData();
        const audioFile = formData.get('file') as File;

        if (!audioFile) {
            return json({ error: 'No audio file provided' }, { status: 400 });
        }

        // Prepare form data for OpenAI
        const openAIFormData = new FormData();
        openAIFormData.append('file', audioFile);
        openAIFormData.append('model', 'whisper-1');
        // prompt is optional context
        // language is optional, can be auto-detected or forced
        // openAIFormData.append('language', 'th'); 

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: openAIFormData
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            return json({ error: 'Transcription failed', details: errorData }, { status: response.status });
        }

        const data = await response.json();
        return json({ text: data.text });

    } catch (error) {
        console.error('Transcription error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
