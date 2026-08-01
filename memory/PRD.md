# DuoVault — Private Media App for Two

## Overview
A private mobile scrapbook app for two users. Photo/video gallery on Cloudinary, real-time-ish chat between the two users, drawing/scribble canvas, and AI image generation from selected photos using Gemini Nano Banana.

## Features
- **Auth**: Two seeded accounts (user1, user2 / changeme). First-login mandatory password change.
- **Profile**: Name, username, nickname, mobile number.
- **Gallery**: Staggered grid. Long-press or Select to enter multi-select mode. Bulk delete or "Create with AI" from selection.
- **Upload**: Single or multiple photos/videos → Cloudinary → MongoDB metadata.
- **Chat**: 2-user chat, polled every 4s.
- **Scribble**: SVG drawing canvas → PNG → Cloudinary → gallery.
- **AI Studio**: Select photos + prompt → Gemini gemini-2.5-flash-image-preview → new image saved to gallery.

## Tech
- Backend: FastAPI + Motor + JWT + bcrypt
- Frontend: Expo Router + expo-image + expo-video + react-native-svg + react-native-view-shot + @gorhom (unused, moved to Modal sheet)
- Storage: Cloudinary (photos/videos), MongoDB (users, media, messages)
- AI: google-genai (user's own Gemini key)

## Env
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- GEMINI_API_KEY
- JWT_SECRET
- MONGO_URL, DB_NAME
