import { MapPin, Home, ExternalLink } from 'lucide-react';

interface LocationErrorPageProps {
  attemptedLocation: string;
  errorMessage: string;
  onGoToDefault: () => void;
}

export const LocationErrorPage = ({ 
  attemptedLocation, 
  onGoToDefault 
}: LocationErrorPageProps) => {
  const googleMapsSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(attemptedLocation)}`;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-8 text-center">
        {/* Logo/Icon with Friendly State */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-3xl rounded-full" />
            <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-2xl shadow-2xl">
              <MapPin className="w-16 h-16 text-white" strokeWidth={1.5} />
              <div className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg">
                <span className="text-blue-500 text-2xl">🔍</span>
              </div>
            </div>
          </div>
        </div>

        {/* Friendly Message */}
        <div className="space-y-4 mb-8">
          <h1 className="text-5xl font-light tracking-tight text-slate-900">
            Let's Find <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Your Location</span>
          </h1>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm">
            <p className="text-slate-600 text-lg mb-3 font-light">
              We couldn't quite locate:
            </p>
            <p className="text-blue-600 font-mono text-xl mb-4 break-all font-medium">
              "{attemptedLocation}"
            </p>
            <p className="text-slate-500 text-sm font-light">
              Let's try searching for it together, or start from our default location.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-8">
          {/* Go to Default Location Button */}
          <button
            onClick={onGoToDefault}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
          >
            <Home className="w-5 h-5" />
            <span className="text-lg font-light">Start at Trevi Fountain</span>
          </button>

          {/* Google Maps Search Link */}
          <a
            href={googleMapsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-medium py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md border border-slate-200"
          >
            <ExternalLink className="w-5 h-5" />
            <span className="text-lg font-light">Search in Google Maps</span>
          </a>
        </div>

        {/* Help Text */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-6 mb-6">
          <h3 className="text-blue-900 font-medium text-lg mb-4">
            How to find your location:
          </h3>
          <ol className="text-left text-slate-700 space-y-3 text-sm font-light">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
              <span>Click "Search in Google Maps" above to open Google Maps</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
              <span>Search for and find your desired location</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
              <span>Copy the location name or address</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
              <span>Update the URL parameter: <code className="bg-white px-2 py-1 rounded text-blue-600 font-mono text-xs">?src=Your Location Name</code></span>
            </li>
          </ol>
        </div>

        {/* Example Locations */}
        <div className="text-slate-500 text-sm font-light">
          <p className="mb-3">Or try these popular locations:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              'Eiffel Tower, Paris',
              'Times Square, New York',
              'Big Ben, London',
              'Colosseum, Rome',
              'Sydney Opera House'
            ].map((location) => (
              <a
                key={location}
                href={`?src=${encodeURIComponent(location)}`}
                className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 transition-all hover:shadow-sm font-light"
              >
                {location}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
