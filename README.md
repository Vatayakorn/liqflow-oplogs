# Operation Log (OpLog)

A mobile-first web application for operations teams to log daily sessions with shift management, time presets, voice dictation, and image attachments.

Built with **SvelteKit**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

![OpLog Screenshot](./docs/screenshot.png)

## Features

- ✅ **Daily Session Logging** - Record operation sessions with detailed fields
- ✅ **Shift Management** - Organize sessions by Shift A, B, or C
- ✅ **Time Presets** - Quick-select fixed times or every 30-minute intervals
- ✅ **Voice Dictation** - Hands-free note-taking with Web Speech API
- ✅ **Image Attachments** - Upload multiple images per session
- ✅ **History View** - Browse past logs by date with summary stats
- ✅ **Mobile-First Design** - Large tap targets, responsive layout

## Quick Start

### 1. Clone and Install

```bash
cd liqflowOPLog
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema from `supabase/schema.sql`
3. Go to **Storage** and create a bucket named `oplog-images` (set to Public for demo)
4. Go to **Settings > API** and copy your credentials

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
src/
├── lib/
│   ├── api/
│   │   └── oplog.ts           # CRUD operations
│   ├── components/
│   │   ├── DictationButton.svelte
│   │   ├── ImageUpload.svelte
│   │   ├── PresetGrid.svelte
│   │   ├── SessionForm.svelte
│   │   ├── SessionList.svelte
│   │   ├── ShiftSelector.svelte
│   │   └── Toast.svelte
│   ├── config/
│   │   └── timePresets.ts     # Time preset configuration
│   ├── stores/
│   │   └── toast.ts           # Toast notifications
│   └── supabaseClient.ts      # Supabase client
├── routes/
│   ├── +layout.svelte         # Global layout
│   ├── +page.svelte           # Redirect to /today
│   ├── today/
│   │   └── +page.svelte       # Main logging page
│   ├── history/
│   │   ├── +page.svelte       # Browse by date
│   │   └── [date]/
│   │       └── +page.svelte   # Sessions for date
│   └── session/
│       └── [id]/
│           └── +page.svelte   # Session detail
└── app.css                    # Global styles
```

## Database Schema

### Tables

- **oplog_days** - One record per unique log date
- **oplog_sessions** - Operation sessions with shift, time, team, and status
- **oplog_session_images** - Image attachments

See `supabase/schema.sql` for full schema.

## Time Presets

### Fixed Presets (Default)
- 17:00
- 22:50
- 22:55
- 22:59

### Every 30 Minutes
Toggle to show all 30-minute intervals: 00:00, 00:30, 01:00, etc.

Presets are configured in `src/lib/config/timePresets.ts`.

## Security Notes

> ⚠️ **IMPORTANT**: This demo uses open RLS policies. Before production:

1. **Enable Supabase Auth** - Add user authentication
2. **Update RLS Policies** - Restrict access by `auth.uid()` or team
3. **Private Storage** - Change bucket to private with signed URLs
4. **Remove Anon Write** - Restrict write access to authenticated users

Example production policy:

```sql
CREATE POLICY "Users can manage their own sessions" ON oplog_sessions
    FOR ALL USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM team_members 
            WHERE user_id = auth.uid() 
            AND team_id = oplog_days.team_id
        )
    );
```

## API Reference

### `getOrCreateDay(log_date: string)`
Get or create a day record for the given date.

### `listSessionsByDate(log_date: string)`
List all sessions for a date, including images.

### `createSession(payload: CreateSessionPayload)`
Create a new session.

### `deleteSession(session_id: string)`
Delete a session and its images.

### `uploadImages(log_date, shift, session_id, files[])`
Upload images to Storage and create image records.

## Browser Compatibility

- **Voice Dictation**: Chrome, Edge, Safari (WebKit Speech API)
- **Other Features**: All modern browsers

## License

MIT
