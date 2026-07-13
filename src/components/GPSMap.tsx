import React, { useState, useEffect, useRef } from 'react';
import { sb } from '../supabaseClient';
import { AppUser, GPSLocation } from '../types';
import { Icon } from './Icons';
import { NoData } from './SharedUI';

declare const L: any; // global Leaflet variable injected in index.html

interface GPSMapProps {
  user: AppUser;
}

export const GPSMap: React.FC<GPSMapProps> = ({ user }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const watchRef = useRef<number | null>(null);
  const myMarker = useRef<any>(null);
  
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locations, setLocations] = useState<GPSLocation[]>([]);
  const [geoErr, setGeoErr] = useState('');
  const [tracking, setTracking] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;

    try {
      // Default setView to India center (as prototype)
      mapInst.current = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInst.current);

      // Customize tiles with a futuristic dark/blue color invert filter (using CSS filter class or custom style)
      const container = mapRef.current;
      if (container) {
        const tiles = container.querySelectorAll('.leaflet-tile');
        tiles.forEach((t: any) => {
          t.style.filter = 'brightness(0.4) hue-rotate(180deg) saturate(0.5)';
        });
      }
    } catch (e: any) {
      console.error("Leaflet initialization failed. Check CDN connection.", e);
      setGeoErr("Map visualizer currently unavailable offline.");
    }

    return () => {
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, []);

  // Save GPS coordinate ping to Supabase
  const saveGPSPing = async (lat: number, lng: number) => {
    try {
      await sb.from('gps_locations').insert({
        employee_id: user?.user_id || 'unknown',
        latitude: lat,
        longitude: lng,
        recorded_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("GPS telemetry save failed:", err);
    }
  };

  // Start live location watching
  const startTracking = () => {
    if (!navigator.geolocation) {
      setGeoErr('Browser geolocation is not supported by your security environment.');
      return;
    }
    setTracking(true);
    setGeoErr('');

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyLoc({ lat, lng });

        if (mapInst.current) {
          mapInst.current.setView([lat, lng], 14);

          // Update/recreate primary employee position marker
          if (myMarker.current) {
            myMarker.current.remove();
          }

          try {
            const pulseMarkup = `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-5 h-5 bg-cyan-400 rounded-full animate-ping opacity-60"></div>
                <div class="w-3.5 h-3.5 bg-cyan-400 border-2 border-slate-100 rounded-full shadow-[0_0_12px_#00f5ff] relative z-10"></div>
              </div>
            `;
            
            myMarker.current = L.marker([lat, lng], {
              icon: L.divIcon({
                className: '',
                html: pulseMarkup,
                iconSize: [14, 14]
              })
            })
              .addTo(mapInst.current)
              .bindPopup(`<b>${user?.name || user?.user_id}</b><br/>Your Current Position (Active Tracker)`);
          } catch (e) {
            console.error("Marker placement failed:", e);
          }
        }
        await saveGPSPing(lat, lng);
      },
      (err) => {
        setGeoErr(err.message);
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  };

  const stopTracking = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setTracking(false);
  };

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  // For employees, force Geolocation immediately upon component mount (and they cannot toggle off)
  useEffect(() => {
    if (user?.role === 'employee') {
      const t = setTimeout(() => {
        startTracking();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  // Load all employee GPS markers from database
  useEffect(() => {
    const loadEmployeePings = async () => {
      const { data } = await sb.from<GPSLocation>('gps_locations').select('*', {
        order: 'recorded_at.desc',
        limit: 50
      });
      if (data && data.length > 0) {
        setLocations(data);

        // Put markers for loaded locations
        data.forEach((l) => {
          if (mapInst.current && l.latitude && l.longitude && l.employee_id !== user?.user_id) {
            try {
              const staticMarkup = `
                <div class="w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-100 rounded-full shadow-[0_0_6px_rgba(57,255,20,0.5)]"></div>
              `;
              L.marker([l.latitude, l.longitude], {
                icon: L.divIcon({
                  className: '',
                  html: staticMarkup,
                  iconSize: [10, 10]
                })
              })
                .addTo(mapInst.current)
                .bindPopup(`<b>Staff Key: ${l.employee_id}</b><br/>Telemetry Ping: ${l.recorded_at ? new Date(l.recorded_at).toLocaleString() : 'N/A'}`);
            } catch (err) {
              console.error(err);
            }
          }
        });
      }
    };

    const t = setTimeout(() => {
      loadEmployeePings();
    }, 500);

    return () => clearTimeout(t);
  }, [user?.user_id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[500px]">
      {/* Map visualizer */}
      <div className="lg:col-span-3 border border-cyan-500/15 rounded bg-slate-950 overflow-hidden relative">
        <div ref={mapRef} className="w-full h-full min-h-[300px] z-10" />
      </div>

      {/* Control panel and tracking metrics */}
      <div className="flex flex-col gap-3 lg:col-span-1 h-full overflow-hidden">
        {/* Status card */}
        <div className="bg-slate-950 border border-cyan-500/10 rounded p-4 relative">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
          <div className="text-[10px] font-bold tracking-widest text-cyan-400 font-mono uppercase mb-3">
            SATELLITE POSITIONING
          </div>
          {myLoc ? (
            <div className="font-mono text-xs text-slate-400 leading-relaxed">
              <div>LATITUDE: <span className="text-slate-100 font-semibold">{myLoc.lat.toFixed(5)}</span></div>
              <div>LONGITUDE: <span className="text-slate-100 font-semibold">{myLoc.lng.toFixed(5)}</span></div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-wider px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE TELEMETRY ON
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs font-mono">{geoErr || 'GPS inactive or searching satellite...'}</div>
          )}
          
          <div className="mt-4">
            {user?.role === 'employee' ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] uppercase text-center rounded tracking-wider leading-relaxed">
                ● GPS Background Tracker Active (Mandatory for Employees)
              </div>
            ) : !tracking ? (
              <button
                onClick={startTracking}
                className="w-full py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400 text-emerald-400 font-mono text-[10px] font-bold tracking-widest uppercase rounded cursor-pointer transition-colors"
              >
                ▶ INITIATE GPS TRACKING
              </button>
            ) : (
              <button
                onClick={stopTracking}
                className="w-full py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400 text-rose-400 font-mono text-[10px] font-bold tracking-widest uppercase rounded cursor-pointer transition-colors"
              >
                ■ CEASE TRACKING
              </button>
            )}
          </div>
          {geoErr && <div className="mt-3 text-rose-400 font-mono text-[10px] uppercase">{geoErr}</div>}
        </div>

        {/* Telemetry logs list */}
        <div className="bg-slate-950 border border-cyan-500/10 rounded p-4 flex-1 flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-emerald-500/25" />
          <div className="text-[10px] font-bold tracking-widest text-emerald-400 font-mono uppercase mb-3 shrink-0">
            RECENT TELEMETRY LOGS
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-cyan-500/5 px-0.5">
            {locations.length === 0 ? (
              <NoData label="NO ACTIVE TRACKERS" />
            ) : (
              locations.slice(0, 8).map((l, i) => (
                <div key={i} className="py-2.5 font-mono text-xs">
                  <div className="text-slate-100 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {l.employee_id}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-1">
                    COORDINATES: {l.latitude?.toFixed(4)}, {l.longitude?.toFixed(4)}
                  </div>
                  <div className="text-slate-600 text-[9px] mt-0.5">
                    {l.recorded_at ? new Date(l.recorded_at).toLocaleTimeString() : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
