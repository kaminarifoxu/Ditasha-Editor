# Photo Booth video and camera markers — v1.68

Open **Photo Booth → Video & keyframe**. The floating panel can be minimized, and also works over the fullscreen viewport.

1. Import and arrange peds, outfits, vehicles and props. Choose each ped's emote and starting phase. The video clock samples the selected emotes independently with their own speeds; it does not add missing rig/clip support.
2. Choose video duration (1–120 seconds), 24/30 FPS and landscape 720p/1080p, portrait 1080p or square 1080.
3. At time zero, orbit/zoom the viewport with the mouse, adjust FOV/roll/light settings and **Tambah/perbarui titik**.
4. Move the playhead to a later time **before** composing the next camera. Scrubbing evaluates existing markers. Compose the next shot and add another point. Adding at the same timestamp replaces that point. Click a diamond to visit it; **Hapus titik** removes the point at the playhead. Up to 64 markers are retained.
5. Select **Linear**, **Halus · ease in/out** or **Cut**. Smooth mode eases on straight segments; it is not a Bezier/spline path editor. Position, look target, FOV, roll, lighting and shadow parameters interpolate; projection/filter/resolution choices change on the next marker.
6. Preview, pause or scrub. **Ekspor WebM** writes an opaque video without audio. Camera markers, duration, render settings and the current view persist with scene presets. Existing presets without a movie remain supported.

## Camera and light controls

- Mouse orbit/pan/dolly, FOV/zoom and camera roll. Fisheye is an equidistant circular projection rendered from six cubemap faces (512 pixels per face), rather than a fake wide perspective FOV. It is heavier and can look softer than a normal 1080p perspective shot. The circle fits portrait and landscape; its outside is black in video. Fisheye is not an equirectangular 360 export, and viewport transform picking still uses the perspective camera.
- Main, fill and ambient intensity; key/fill colors; key-light height, distance and azimuth. The key/fill are directional lights: distance controls direction, not physical inverse-square falloff.
- Shadow enable/strength, 512/1024/2048 map size, Soft PCF/PCF/Hard filter, bias and normal bias. Radius applies in PCF mode. Very large scenes can exceed the existing fixed shadow-camera coverage.

## Export behavior and limits

The preferred exporter uses WebCodecs VP8 with fixed per-frame timestamps and an original minimal WebM muxer. Rendering can take longer than playback; frames are sampled deterministically instead of dropping animation frames to match viewport speed. Encoder queues and source/output budgets are bounded. The WebM has finite duration metadata and no audio/seek index; it is not MP4, a compositor or a multi-shot nonlinear editor.

When VP8 WebCodecs is unavailable, MediaRecorder VP9/VP8 records in real time with explicit frame requests; heavy scenes may lower effective FPS. Keep the application visible. Maximum encoded output is 120 MB, below the desktop export limit. Cancel or failure restores the camera, view dimensions, lights and actor clocks; no partial file is downloaded. Export excludes toolbars and gizmos. Preview follows the selected video aspect while the movie panel is open; closing it restores the photo aspect.

## Research references

- Rockstar: marker-based linear/smooth camera transitions and restrained effects: https://www.rockstargames.com/ru/newswire/article/ak14o883842278/rockstar-editor-tips-camera-effects-soundtrack
- Blender official camera manual: FOV/focal length and fisheye projections: https://docs.blender.org/manual/en/5.4/render/cycles/object_settings/cameras.html
- YouTube, MK Graphics — _Blender 3.3 Camera Controls And Animation Tutorial_: https://www.youtube.com/watch?v=r9i6g-pToVM (camera motion, interpolation, paths and tracking).
- YouTube, Malin.mp4 — _Dolly Zoom Effect_: https://www.youtube.com/watch?v=e5lkoRJBUf0 (camera and lens changes). Search descriptions/chapter metadata were reviewed; the videos were not watched frame by frame.
- Reddit, practical discussion about linear versus eased camera motion: https://www.reddit.com/r/blenderhelp/comments/1u5y43y/help_with_camera_animation/ (community feedback, not a technical specification).
- WebCodecs API: https://www.w3.org/TR/webcodecs/
- Container layout: https://www.matroska.org/technical/elements.html and https://www.matroska.org/technical/codec_specs.html

This implementation is original DITASHA code; it does not copy CodeWalker's renderer. CodeWalker study/local experimentation remains separate from permission to redistribute its entire source. Encrypted GTA RPF support and full-world streaming are not introduced by the video feature.
