import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PrivateRoute from './components/PrivateRoute';
import FlightSearch from './pages/FlightSearch';
import HotelSearch from './pages/HotelSearch';
import BusSearch from './pages/BusSearch';
import PackageSearch from './pages/PackageSearch';



function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/flights" element={<FlightSearch />} />
          <Route path="/hotels" element={<HotelSearch />} />
          <Route path="/buses" element={<BusSearch />} />
          <Route path="/packages" element={<PackageSearch />} />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;