# Discord Activity

DITASHA Editor connects to the local Discord desktop client using Discord RPC over IPC. It publishes the active workspace and session start time. When project sharing is enabled, the activity also includes the project/asset label. Full folder paths, file contents, account credentials and server details are not published. Workspace and project visibility can be disabled separately.

## One-time setup

1. Open [Discord Developer Portal](https://discord.com/developers/applications) and choose **New Application**. Name it **DITASHA Editor**. The activity title belongs to this Discord application.
2. In **General Information**, copy **Application ID**. This is a public numeric identifier, not a bot token or client secret. An application icon can be set on the application's page; the in-app activity card is a visual example, not a live Discord profile capture.
3. Open **Pengaturan → Discord Activity** in DITASHA Editor, enter the ID, keep **Aktif** checked, then **Simpan & hubungkan**.
4. Keep Discord desktop running under the same Windows user. Enable activity sharing in Discord's **Activity Privacy**. Discord in a browser does not provide the local desktop IPC connection used here.

No ID is bundled in this release because the project owner has not created one yet. Settings persist across restarts and updates. Once a project Application ID exists, its owner can also set the public `discordApplicationId` field in package.json and release a new build, giving other users a default ID without requiring each user to configure it. User overrides remain in the local preferences.

## Status and behavior

- **Isi Application ID**: finish the setup above.
- **Menghubungkan**: waiting for the local Discord handshake and activity acknowledgement.
- **Activity terkirim**: Discord acknowledged SET_ACTIVITY; the user's Activity Privacy and Discord profile visibility still determine whether others see it.
- **Buka Discord / terputus**: the app retries automatically.
- **Discord menolak Activity**: check the Application ID, the Discord application and client settings, then save again.

Workspace changes are coalesced to avoid flooding Discord. The session timer stays consistent after reconnect. Disabling Activity clears the published activity and disconnects; closing the editor also clears it. The engine is non-blocking and does not prevent asset editing if Discord is unavailable.

## Nama proyek

Activity dapat menampilkan nama aset/proyek aktif (tanpa path folder lengkap). Matikan **Tampilkan nama proyek di Activity** untuk menyembunyikannya. Isian **Nama proyek** di Pengaturan memberi nama manual yang diprioritaskan; kosongkan untuk kembali mengikuti aset aktif. Auto Rig, Explorer, Texture & Model dan Model Viewer memperbarui nama dari input yang dipilih. Untuk nama proyek Code Studio, gunakan isian manual.

## Verification

`tests/discord-presence.test.cjs` checks public-ID validation, known workspace values, frame splitting and coalescing, ping/pong, throttling, connection recovery, privacy mode, clearing and trusted settings persistence. Tests use an in-memory peer and a local named-pipe/Unix-socket fixture; environments that prohibit local sockets skip only the transport fixture. Windows release CI runs the pipe fixture. A real Discord account/profile is not used in automated tests and needs a valid Application ID for manual validation.

References: [Discord RPC protocol](https://github.com/discord/discord-rpc/blob/master/documentation/hard-mode.md), [Discord Rich Presence](https://discord.com/developers/docs/rich-presence/overview).
