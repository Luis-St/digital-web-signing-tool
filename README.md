# Waiver System

A digital waiver management system for entertainment venues offering laser tag and escape room experiences.

## Overview

This application streamlines the process of collecting and managing liability waivers for activity participants. It replaces traditional paper-based waivers with a digital system that allows for better organization, storage, and retrieval
of signed documents.

## Features

- **Admin Interface**: Allows staff to manage participant groups and assign them to available tablets
- **Tablet Interface**: User-friendly interface for collecting participant information and signatures
- **Real-time Communication**: WebSocket-based communication between admin station and tablets
- **PDF Generation**: Automatically generates and stores signed waiver documents
- **Multi-tablet Support**: Supports multiple concurrent signing stations
- **Offline Capability**: Continues to function during temporary network interruptions

## System Requirements

### Hardware

- Admin Station: Desktop or laptop computer
- Signing Stations: Tablets with touch capability (for signature capture)
- Local network connection between devices

### Software

- Node.js (v14+)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- PDF reader for viewing generated waivers

## Technical Stack

- **Frontend**: Vue.js 3 with Composition API, Tailwind CSS
- **Backend**: Node.js with Express
- **Communication**: WebSocket (ws library)
- **Build Tools**: Vite
- **State Management**: Pinia
- **PDF Generation**: Puppeteer

## Project Structure

```
├── src/
│   ├── components/           # Reusable Vue components
│   │   └── SignatureCanvas.vue   # Signature capture component
│   ├── stores/               # Pinia state management
│   │   ├── admin.js          # Admin state and WebSocket connection
│   │   ├── players.js        # Player data management
│   │   └── tablets.js        # Tablet state and communication
│   ├── views/                # Main application views
│   │   ├── AdminLogin.vue    # Admin authentication
│   │   ├── AdminView.vue     # Main admin interface
│   │   └── TabletView.vue    # Tablet signing interface
│   ├── App.vue               # Root Vue component
│   └── main.js               # Application entry point
├── server/
│   ├── pdf.js                # PDF generation utilities
│   ├── server.js             # Main server file (Express + WebSocket)
│   └── waiver-template.html  # HTML template for PDF generation
├── storage/                  # PDF storage directory
│   └── waivers/              # Generated PDF waivers
```

## Functional Requirements

1. **Admin Station Capabilities**
    - Authentication for staff access
    - Selection of activity type (laser tag or escape room)
    - Specification of number of participants
    - Assignment of participant group to available tablets
    - Monitoring of tablet status (available, busy)

2. **Tablet Station Capabilities**
    - Registration with unique tablet identifier
    - Collection of participant information:
        - First name and last name (separate fields)
        - Date of birth (required)
    - Display of waiver text for each participant
    - Signature capture via touch interface
    - Sequential processing of all participants in group
    - Welcome screen display after all participants have signed

3. **Document Management**
    - Automatic PDF generation with participant information
    - Embedded signature image in PDF
    - Storage of signed waivers on server
    - Standardized naming convention for easy retrieval

## Installation

1. Clone the repository

```bash
git clone https://github.com/your-org/waiver-system.git
cd waiver-system
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env` file with the following variables:

```
PORT=5000
PDF_STORAGE_PATH=./storage/waivers
PDF_STORAGE_URL=http://localhost:5000
VITE_SOCKET_URL=ws://localhost:5000
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=password
VITE_TABLET_TOKEN=tabletaccess
```

4. Create the storage directory

```bash
mkdir -p storage/waivers
```

## Running the Application

1. Start the development server

```bash
npm run dev
```

2. In a separate terminal, start the backend server

```bash
node server/server.js
```

3. Access the admin interface at `http://localhost:3000/admin`
4. Access the tablet interface at `http://localhost:3000/tablet`

## Deployment

For production deployment:

1. Build the frontend

```bash
npm run build
```

2. Set the `NODE_ENV` environment variable to `production`

```bash
export NODE_ENV=production
```

3. Start the server

```bash
node server/server.js
```

The application will serve the static files from the `dist` directory and handle API requests.
