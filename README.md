# You Are Here Vibing

AR-based navigation app using Google Street View with motion tracking.

## Features

- **Google Street View Integration**: Immersive street-level navigation
- **Motion Tracking**: Real-time body pose detection and tracking
- **URL Parameters**: Support for source and destination locations
- **Geocoding**: Automatic conversion of location names to coordinates
- **Error Recovery**: User-friendly error handling with recovery options

## URL Parameters

### Source Location (`src`)
Specify the starting location for Street View:
```
?src=Eiffel Tower, Paris
?src=Times Square, New York
?src=Big Ben, London
```

If no `src` parameter is provided, defaults to Trevi Fountain, Rome.

**Error Handling**: If the location cannot be found, you'll see an informative error page with:
- Clear explanation of the issue
- Button to return to default location (Trevi Fountain)
- Link to search in Google Maps for the correct location name
- Step-by-step instructions for finding and using location names
- Example locations to try

### Destination Location (`dst`)
Specify a destination location:
```
?dst=Colosseum, Rome
?dst=Statue of Liberty, New York
```

### Combined Example
```
?src=Eiffel Tower, Paris&dst=Arc de Triomphe, Paris
```

## How to Find a Location

If you get a "Location Not Recognised" error:

1. Click the "Search in Google Maps" button on the error page
2. Search for your desired location in Google Maps
3. Copy the location name or address from Google Maps
4. Update your URL with the location: `?src=Your Location Name`

**Example workflow:**
- Try: `?src=some random place` → Error page appears
- Click "Search in Google Maps"
- Find the correct location in Google Maps
- Copy the name: "Central Park, New York, NY"
- Use: `?src=Central Park, New York, NY`

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Google Maps API key:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Google Maps API Requirements

This project requires the following Google Maps APIs to be enabled:
- **Maps JavaScript API**: For Street View functionality
- **Geocoding API**: For converting location names to coordinates

Make sure both APIs are enabled in your Google Cloud Console project.

## Technology Stack

- **React** + **TypeScript**: UI framework
- **Vite**: Build tool
- **Redux Toolkit**: State management
- **TensorFlow.js**: Motion tracking and pose detection
- **Google Maps JavaScript API**: Street View and geocoding
- **Lucide React**: Icon library

## Development

The project uses:
- Motion tracking overlay for AR features
- Real-time pose detection with BlazePose
- Shoulder tracking for heading control
- Redux for centralised state management
- Comprehensive error handling with user-friendly recovery
- Splash screen for smooth app initialisation

## Browser Compatibility

Requires a modern browser with:
- WebGL support
- Camera access for motion tracking
- JavaScript enabled
