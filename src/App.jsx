import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Scan from './pages/Scan.jsx'
import Activate from './pages/Activate.jsx'
import Profile from './pages/Profile.jsx'
import ModelPreview from './pages/ModelPreview.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/profile" element={<Profile />} />
      {/* Herramienta de desarrollo: revisar modelos sin AR ni backend */}
      <Route path="/preview" element={<ModelPreview />} />
    </Routes>
  )
}

export default App
