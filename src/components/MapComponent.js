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
        setPath((prevPath) => [...prevPath, pos]); // Add to trail
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
    } else {
      console.error('Error fetching directions:', status);
      alert('Failed to fetch directions. Please check your locations.');
    }
    setIsRequestingDirections(false);
  };

  const requestDirections = () => {
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
  };

  const handleModeSelect = (mode) => {
    if (emissions && emissions[selectedVehicle]) {
      setTotalDistance(totalDistance + distance / 1000);
      setTotalCost(totalCost + costs[selectedVehicle]);
      setTotalEmissions(totalEmissions + emissions[selectedVehicle]);
    }
  };

  return (
    <div>
      <div className="container">
        <div className="sidebar">
          <div className = "card">
            {!isTracking ? (
             <button onClick={setLocation}>Get Location</button>
              ) : (
                    <button onClick={stopLocationTracking}>Stop Location</button>
              )}
            <img src={GPS} alt="GPS" width="100%" height="55%"/>
            <nav className='flex flex-row gap-x-2 w-full z-20 fixed top-0 left-0 h-12 border-b place-content-center items-center bg-gray-200'>
                        {
                            userLoggedIn
                                ?
                                <>
                                    <button onClick={() => { doSignOut().then(() => { navigate('/login') }) }} className='text-sm text-blue-600 underline'>Logout</button>
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
            <p>{distance / 1000} km / {(distance * 0.000621371).toFixed(2)} miles</p>
          </div>
          <div className="card">
            <h3>Total Cost</h3>
            <p>
              {costs && costs[selectedVehicle]
                ? `$${costs[selectedVehicle].toFixed(2)}`
                : '$0'}
            </p>
          </div>
          <div className="card">
            <h3>Total CO2 Emissions</h3>
            <p>
              {emissions && emissions[selectedVehicle]
                ? `${emissions[selectedVehicle].toFixed(2)} kg CO2`
                : '0 kg CO2'}
            </p>
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
              <button
                onClick={() => {
                  requestDirections();
                  handleModeSelect(selectedVehicle);
                }}
              >
                Get Directions
              </button>
            </div>
          </div>

          <div className="map-container">
            <LoadScript
  googleMapsApiKey={GOOGLE_MAPS_API_KEY}
  libraries={['places']}
  onLoad={() => {
    if (startRef.current && endRef.current && window.google) {
      const autocompleteStart = new window.google.maps.places.Autocomplete(startRef.current, {
        types: ['geocode', 'establishment'],
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
              </>
            )}
          </div>
        </div>
      </div>
</div>
    
  );
};


export default MapComponent;