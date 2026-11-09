import { formatDay } from '@/lib/tripDates';
import { useQuery } from '@tanstack/react-query';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Loader2, AlertCircle } from 'lucide-react';

// Mountain name → approximate coordinates (Philippines focus + common PH peaks)
const MOUNTAIN_COORDS = {
  'apo': { lat: 6.988, lon: 125.270 },
  'pulag': { lat: 16.590, lon: 120.889 },
  'halcon': { lat: 13.041, lon: 121.047 },
  'dulang-dulang': { lat: 7.859, lon: 124.896 },
  'tabayoc': { lat: 16.562, lon: 120.899 },
  'kitanglad': { lat: 8.188, lon: 124.876 },
  'kalatungan': { lat: 7.862, lon: 124.794 },
  'musuan': { lat: 7.877, lon: 125.059 },
  'hamiguitan': { lat: 6.748, lon: 126.170 },
  'hibok-hibok': { lat: 9.205, lon: 124.671 },
  'kanlaon': { lat: 10.412, lon: 123.132 },
  'bulusan': { lat: 12.769, lon: 124.055 },
  'mayon': { lat: 13.254, lon: 123.685 },
  'banahaw': { lat: 14.068, lon: 121.488 },
  'cristobal': { lat: 14.070, lon: 121.421 },
  'makiling': { lat: 14.127, lon: 121.194 },
  'romelo': { lat: 14.185, lon: 121.384 },
  'batulao': { lat: 14.000, lon: 120.843 },
  'pico de loro': { lat: 14.035, lon: 120.808 },
  'maculot': { lat: 13.961, lon: 121.077 },
  'marami': { lat: 14.032, lon: 121.095 },
  'tagapo': { lat: 14.300, lon: 121.283 },
  'sembrano': { lat: 14.213, lon: 121.368 },
  'ugo': { lat: 16.520, lon: 120.910 },
  'ulap': { lat: 16.500, lon: 120.883 },
  'timbak': { lat: 16.713, lon: 120.830 },
  'amuyao': { lat: 17.011, lon: 121.150 },
  'data': { lat: 16.890, lon: 120.885 },
};

function getCoords(mountainName) {
  if (!mountainName) return null;
  const key = mountainName.toLowerCase().trim();
  for (const [k, v] of Object.entries(MOUNTAIN_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

function WeatherIcon({ code, className = 'w-8 h-8' }) {
  // WMO weather code → icon
  if (code <= 1) return <Sun className={`${className} text-yellow-400`} />;
  if (code <= 3) return <Cloud className={`${className} text-gray-400`} />;
  if (code <= 67) return <CloudRain className={`${className} text-blue-400`} />;
  if (code <= 77) return <CloudSnow className={`${className} text-blue-200`} />;
  return <CloudRain className={`${className} text-blue-600`} />;
}

function weatherDesc(code) {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

async function fetchWeather(lat, lon, date) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,precipitation_probability_max&timezone=Asia%2FManila&forecast_days=16`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();

  const idx = date ? data.daily.time.indexOf(date) : 0;
  const i = idx >= 0 ? idx : 0;
  return {
    date: data.daily.time[i],
    code: data.daily.weathercode[i],
    maxTemp: data.daily.temperature_2m_max[i],
    minTemp: data.daily.temperature_2m_min[i],
    rain: data.daily.precipitation_sum[i],
    rainProb: data.daily.precipitation_probability_max[i],
    wind: data.daily.windspeed_10m_max[i],
    // Next 3 days for mini forecast
    forecast: [0, 1, 2, 3].map(offset => ({
      date: data.daily.time[i + offset],
      code: data.daily.weathercode[i + offset],
      max: data.daily.temperature_2m_max[i + offset],
      min: data.daily.temperature_2m_min[i + offset],
    })).filter(d => d.date),
  };
}

export default function TripWeather({ trip }) {
  const coords = getCoords(trip?.mountain_name);
  const tripDate = trip?.start_date; // 'YYYY-MM-DD'

  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['trip-weather', coords?.lat, coords?.lon, tripDate],
    queryFn: () => fetchWeather(coords.lat, coords.lon, tripDate),
    enabled: !!coords,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  if (!coords) return null; // Mountain not in our coords map — silently skip

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Cloud className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Weather forecast</h3>
        <span className="text-xs text-muted-foreground">· {trip.mountain_name}</span>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <AlertCircle className="w-4 h-4" />
          Could not load weather data.
        </div>
      )}

      {weather && (
        <>
          {/* Main weather card */}
          <div className="flex items-center gap-4 mb-4 p-4 bg-muted rounded-xl">
            <WeatherIcon code={weather.code} className="w-12 h-12" />
            <div className="flex-1">
              <p className="font-semibold text-lg">{weather.maxTemp}°C <span className="text-sm text-muted-foreground font-normal">/ {weather.minTemp}°C</span></p>
              <p className="text-sm text-muted-foreground">{weatherDesc(weather.code)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tripDate ? `Trip day: ${formatDay(tripDate, 'en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Current forecast'}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-muted rounded-lg">
              <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Rain chance</p>
              <p className="text-sm font-semibold">{weather.rainProb ?? '--'}%</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <CloudRain className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Precipitation</p>
              <p className="text-sm font-semibold">{weather.rain ?? '--'} mm</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <Wind className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Max wind</p>
              <p className="text-sm font-semibold">{weather.wind ?? '--'} km/h</p>
            </div>
          </div>

          {/* 4-day mini forecast */}
          {weather.forecast.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {weather.forecast.map((day, i) => (
                <div key={day.date} className={`text-center p-2 rounded-lg ${i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {i === 0 ? 'Trip day' : formatDay(day.date, 'en-PH', { weekday: 'short' })}
                  </p>
                  <WeatherIcon code={day.code} className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs font-medium">{day.max}°</p>
                  <p className="text-xs text-muted-foreground">{day.min}°</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3">Powered by Open-Meteo · Mountain elevation may vary</p>
        </>
      )}
    </div>
  );
}
