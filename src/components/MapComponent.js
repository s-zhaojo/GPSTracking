import React, { useEffect, useState, useRef } from 'react';
import {
  GoogleMap,
  LoadScript,
  DirectionsService,
  DirectionsRenderer,
  places
} from '@react-google-maps/api';
import './styles.css';
import GPS from './GPS.jpg';
import { useAuth } from '../contexts/authContext';
import { Link, useNavigate } from 'react-router-dom'
import { doSignOut } from '../firebase/auth'
import { Marker, Polyline } from '@react-google-maps/api';
import axios from 'axios';




const GOOGLE_MAPS_API_KEY = 'AIzaSyD2So3MFuZo2C7B_qfrD1I-3mmaPuzl-rQ';

let infoWindow;

const containerStyle = {
  width: '100%',
  height: '60vh',
};

const carbonEmissions = {
  car: 0.411,
  truck: 1.3,
  bus: 0.089,
  motorcycle: 0.16,
  airplane: 0.255,
};

const transportationCosts = {
  car: 0.13,
  truck: 0.25,
  bus: 0.05,
  motorcycle: 0.08,
  airplane: 0.15,
};

const speeds = {
  car: 60,
  truck: 50,
  bus: 30,
  motorcycle: 70,
  airplane: 500,
};

const MapComponent = () => {
  const [path, setPath] = useState([]);        
  const [autoCenter, setAutoCenter] = useState(true); 
  const startRef = useRef(null);
  const endRef = useRef(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate()
  const [userLocation, setUserLocation] = useState(null);
  const { userLoggedIn } = useAuth()
  const [mapCenter, setMapCenter] = useState({ lat: 37.7749, lng: -122.4194 });
  const [watchId, setWatchId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [zoom, setZoom] = useState(10);
  const [directions, setDirections] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [isRequestingDirections, setIsRequestingDirections] = useState(false);
  const [distance, setDistance] = useState(null);
  const [emissions, setEmissions] = useState('car');
  const [costs, setCosts] = useState(null);
  const [durationsByMode, setDurationsByMode] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState('car');
  const [flightNumber, setFlightNumber] = useState('');
  const [flightTime, setFlightTime] = useState('');
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [totalEmissions, setTotalEmissions] = useState(0);



const setLocation = () => {
  if (navigator.geolocation) {
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log("User location:", pos);
        setUserLocation(pos);
        if (autoCenter) {
          setMapCenter(pos);
        }
        setZoom(16);
        setPath((prevPath) => [...prevPath, pos]); 
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Error getting location: " + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1000,
      }
    );
    setWatchId(id);
    setIsTracking(true);
  } else {
    alert("Geolocation is not supported by this browser.");
  }
};

const getBestTransportTips = () => {
  if (!emissions || !costs || !durationsByMode) return null;

  const durationsInMinutes = Object.entries(durationsByMode).reduce((acc, [mode, value]) => {
    const [h, m] = value.split('h ').map(s => parseInt(s));
    acc[mode] = h * 60 + m;
    return acc;
  }, {});

  const cheapest = Object.entries(costs).reduce((a, b) => (a[1] < b[1] ? a : b))[0];
  const greenest = Object.entries(emissions).reduce((a, b) => (a[1] < b[1] ? a : b))[0];
  const fastest = Object.entries(durationsInMinutes).reduce((a, b) => (a[1] < b[1] ? a : b))[0];

  return {
    cheapest,
    greenest,
    fastest
  };
};



const stopLocationTracking = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setIsTracking(false);
    setUserLocation(null);
    setPath([]); 
  }
};



  const handleDirectionsResponse = (result, status) => {
    if (status === 'OK') {
      setDirections(result);
      const route = result.routes[0];
      const distInMeters = route.legs[0].distance.value;
      const distInKm = distInMeters / 1000;
      const distInMiles = distInKm * 0.621371;

      setDistance(distInMeters);

      const modeEmissions = {
        car: distInMiles * carbonEmissions.car,
        truck: distInMiles * carbonEmissions.truck,
        bus: distInMiles * carbonEmissions.bus,
        motorcycle: distInMiles * carbonEmissions.motorcycle,
        airplane: distInMiles * carbonEmissions.airplane,
      };
      setEmissions(modeEmissions);

      const modeCosts = {
        car: distInMiles * transportationCosts.car,
        truck: distInMiles * transportationCosts.truck,
        bus: distInMiles * transportationCosts.bus,
        motorcycle: distInMiles * transportationCosts.motorcycle,
        airplane: distInMiles * transportationCosts.airplane,
      };
      setCosts(modeCosts);

      const modeDurations = {};
      Object.keys(speeds).forEach((mode) => {
        const speed = speeds[mode];
        const durationInHours = distInMiles / speed;
        const hours = Math.floor(durationInHours);
        const minutes = Math.round((durationInHours - hours) * 60);
        modeDurations[mode] = `${hours}h ${minutes}m`;
      });
      setDurationsByMode(modeDurations);

      setTotalDistance(prev => prev + distInKm);
      setTotalEmissions(prev => prev + modeEmissions[selectedVehicle]);
      setTotalCost(prev => prev + modeCosts[selectedVehicle]);
    } else {
      console.error('Error fetching directions:', status);
      alert('Failed to fetch directions. Please check your locations.');
    }
    setIsRequestingDirections(false);
  };

  const requestDirections = async () => {
  if (!start || !end) {
    alert('Please enter both start and end locations.');
    return;
  }

  setIsRequestingDirections(true);
  setDirections(null);
  setDistance(null);
  setEmissions(null);
  setCosts(null);
  setDurationsByMode(null);

  const geocoder = new window.google.maps.Geocoder();

 

  if (selectedVehicle === 'airplane') {
  const geocoder = new window.google.maps.Geocoder();

  geocoder.geocode({ address: start }, (startResults, status) => {
    if (status === 'OK' && startResults.length > 0) {
      const startLoc = startResults[0].geometry.location;

      geocoder.geocode({ address: end }, (endResults, status) => {
        if (status === 'OK' && endResults.length > 0) {
          const endLoc = endResults[0].geometry.location;

          const startCoord = {
            lat: startLoc.lat(),
            lng: startLoc.lng(),
          };
          const endCoord = {
            lat: endLoc.lat(),
            lng: endLoc.lng(),
          };

          const distanceKm = haversineDistance(startCoord, endCoord);
          const distanceMiles = distanceKm * 0.621371;

          const emission = distanceMiles * carbonEmissions.airplane;
          const cost = distanceMiles * transportationCosts.airplane;
          const durationHr = distanceMiles / speeds.airplane;
          const hours = Math.floor(durationHr);
          const minutes = Math.round((durationHr - hours) * 60);

          setPath([startCoord, endCoord]);
          setMapCenter(startCoord);
          setZoom(4);
          setDirections(null); // Clear previous route
          setDistance(distanceKm * 1000);
          setEmissions({ airplane: emission });
          setCosts({ airplane: cost });
          setDurationsByMode({ airplane: `${hours}h ${minutes}m` });

          setTotalDistance(prev => prev + distanceKm);
          setTotalEmissions(prev => prev + emission);
          setTotalCost(prev => prev + cost);
        } else {
          alert('Error geocoding destination');
        }
      });
    } else {
      alert('Error geocoding start location');
    }
  });

  

  setIsRequestingDirections(false);
} else {
  const service = new window.google.maps.DirectionsService();
  service.route(
    {
      origin: start,
      destination: end,
      travelMode: 'DRIVING',
    },
    handleDirectionsResponse
  );
}

};



  const handleModeSelect = (mode) => {
    if (emissions && emissions[selectedVehicle]) {
      setTotalDistance(totalDistance + distance / 1000);
      setTotalCost(totalCost + costs[selectedVehicle]);
      setTotalEmissions(totalEmissions + emissions[selectedVehicle]);
    }
  };

  const haversineDistance = (coord1, coord2) => {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371; // km

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


  return (
    <div>
      <div className="container">
        <div className="sidebar">
          <div className = "card">
            {!isTracking ? (
             <button className = "coolbuttons" onClick={setLocation}>Get Location</button>
              ) : (
                    <button className = "coolbuttons" onClick={stopLocationTracking}>Stop Location</button>
              )}
            <img src={GPS} alt="GPS" width="100%" height="55%"/>
            <nav className='flex flex-row gap-x-2 w-full z-20 fixed top-0 left-0 h-12 border-b place-content-center items-center bg-gray-200'>
                        {
                            userLoggedIn
                                ?
                                <>
                                    <button onClick={() => { doSignOut().then(() => { navigate('/login') }) }} className='coolbuttons text-sm text-blue-600 underline'>Logout</button>
                                </>
                                :
                                <>
                                    
                                </>
                        }
            
                    </nav>
             <div className='text-2xl font-bold pt-14'>Hello {currentUser.displayName ? currentUser.displayName : currentUser.email}, you are now logged in.</div>
          </div>
          <div className="card">
            <h3>Total Distance</h3>
            <p>{totalDistance.toFixed(2)} km / {(totalDistance * 0.621371).toFixed(2)} miles</p>
          </div>
          <div className="card">
            <h3>Total Cost</h3>
            <p>
              ${totalCost.toFixed(2)}
            </p>
          </div>
          <div className="card">
            <h3>Total CO2 Emissions</h3>
            <p>
              {totalEmissions.toFixed(2)} kg CO2
            </p>
          </div>
          <div className="card">
  <button onClick={() => {
    setTotalDistance(0);
    setTotalCost(0);
    setTotalEmissions(0);
  }}>
    Reset Totals
  </button>
</div>
        </div>

        <div className="main-content">
          <div className="header">
            <h1>CO2 Tracker</h1>
            <div className="input-container">
              <input
                ref={startRef}
                className="search-bar"
                type="text"
                placeholder="Start Location"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <input
                ref={endRef}
                className="search-bar"
                type="text"
                placeholder="End Location"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
              <label htmlFor="vehicle">Vehicle type:</label>
              <select
                name="vehicle"
                id="vehicle"
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
              >
                <option value="car">Car</option>
                <option value="truck">Truck</option>
                <option value="bus">Bus</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="airplane">Airplane</option>
              </select>
              <button onClick={requestDirections}>
                  Get Directions
              </button>
            </div>
          </div>

          <div className="map-container">
            <LoadScript
  googleMapsApiKey={GOOGLE_MAPS_API_KEY}
  libraries={['places', 'geometry']}
  onLoad={() => {
    if (startRef.current && endRef.current && window.google) {
      const autocompleteStart = new window.google.maps.places.Autocomplete(startRef.current, {
        types: ['geocode', 'establishment'],
        locationBias: {
    radius: 50000000000000000000, 
    center: { lat: 47.6062, lng: -122.3321 } 
  }
      });
      autocompleteStart.addListener('place_changed', () => {
        const place = autocompleteStart.getPlace();
        if (place.formatted_address) {
          setStart(place.formatted_address);
        } else {
          setStart(place.name || '');
        }
      });

      const autocompleteEnd = new window.google.maps.places.Autocomplete(endRef.current, {
        types: ['geocode', 'establishment'],
      });
      autocompleteEnd.addListener('place_changed', () => {
        const place = autocompleteEnd.getPlace();
        if (place.formatted_address) {
          setEnd(place.formatted_address);
        } else {
          setEnd(place.name || '');
        }
      });
    }
  }}
>

              <GoogleMap
  mapContainerStyle={containerStyle}
  center={autoCenter ? mapCenter : undefined}
  zoom={zoom}
  onDragStart={() => setAutoCenter(false)}
  
>
  {isRequestingDirections && start && end && (
  <DirectionsService
    options={{
      destination: end,
      origin: start,
      travelMode: 'DRIVING',
    }}
    callback={handleDirectionsResponse}
  />
)}


  {directions && (
    <DirectionsRenderer
      directions={directions}
      options={{
        polylineOptions: {
          strokeColor: '#4CAF50',
          strokeWeight: 5,
        },
      }}
    />
  )}
  
  {userLocation && (
    <Marker
      position={userLocation}
      icon={{
        url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      }}
    />
  )}
  {path.length > 1 && (
    <Polyline
      path={path}
      options={{
        strokeColor: "#4285F4",
        strokeOpacity: 0.8,
        strokeWeight: 4,
      }}
    />
  )}

  {selectedVehicle === 'airplane' && path.length === 2 && (
  <Polyline
    path={path}
    options={{
      strokeColor: "#f44336",
      strokeOpacity: 0.8,
      strokeWeight: 4,
    }}
  />
)}
</GoogleMap>

            </LoadScript>
          </div>
          

          <div className="trip-details">
            {directions && (
              <>
                <div className="card">
                  <h3>Distance</h3>
                  <div className="section-title">
                    <span>Distance:</span>
                    <span className="section-value">
                      {distance / 1000} km / {(distance * 0.000621371).toFixed(2)} miles
                    </span>
                  </div>
                </div>

                <div className="card">
                  <h3>Carbon Emissions (in kg CO2)</h3>
                  <ul>
                    {Object.keys(emissions).map((mode) => (
                      <li key={mode}>
                        <span className="section-title">
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}:
                        </span>
                        <span className="section-value">
                          {emissions[mode].toFixed(2)} kg CO2
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card">
                  <h3>Estimated Costs</h3>
                  <ul>
                    {Object.keys(costs).map((mode) => (
                      <li key={mode}>
                        <span className="section-title">
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}:
                        </span>
                        <span className="section-value">
                          ${costs[mode].toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card">
                  <h3>Duration</h3>
                  <ul>
                    {Object.keys(durationsByMode).map((mode) => (
                      <li key={mode}>
                        <span className="section-title">
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}:
                        </span>
                        <span className="section-value">
                          {durationsByMode[mode]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="card">
  <h3>Airplane Flight Duration</h3>
  <p>{flightTime || "Please enter a flight number to see the flight time."}</p>
</div>

                <div className="card">
                  <h3>Select Mode of Transport</h3>
                  <ul>
                    {Object.keys(speeds).map((mode) => (
                      <li key={mode}>
                        <button onClick={() => handleModeSelect(mode)}>
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>



                {emissions && costs && durationsByMode && (
  <div className="card">
    <h3>Travel Tips</h3>
    {(() => {
      const tips = getBestTransportTips();
      return tips ? (
        <ul>
          <li>
            🚗 <strong>Fastest:</strong> {tips.fastest.charAt(0).toUpperCase() + tips.fastest.slice(1)}
          </li>
          <li>
            💰 <strong>Cheapest:</strong> {tips.cheapest.charAt(0).toUpperCase() + tips.cheapest.slice(1)}
          </li>
          <li>
            🌱 <strong>Eco-friendliest:</strong> {tips.greenest.charAt(0).toUpperCase() + tips.greenest.slice(1)}
          </li>
        </ul>
      ) : (
        <p>Calculating best options...</p>
      );
    })()}
  </div>
)}

              </>
            )}
          </div>
        </div>
      </div>
</div>
    
  );
};


export default MapComponent;