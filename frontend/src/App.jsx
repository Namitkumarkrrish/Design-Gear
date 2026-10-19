
import { useState } from 'react';
import GearForm from './components/GearForm/GearForm';
import GearResults from './components/GearResults/GearResults';
import GearViewer from './components/GearViewer/GearViewer';
import './App.css';

const API_URL = 'http://127.0.0.1:8000';

const initialGearData = {
  power: 23,
  pinionSpeed: 550,
  gearRatio: 3,
  pressureAngle: 20,
  pinionStrength: 580,
  gearStrength: 750,
  serviceFactor: 1.5,
  bhn: 350,
  gearSystem: '20fdi',
  factorOfSafety: 2,
  pinionModulus: 210000,
  gearModulus: 210000,
  faceWidthFactor: 12,
};

function App() {
  const [gearType, setGearType] = useState('spur');
  const [gearData, setGearData] = useState(initialGearData);

  const [designResponse, setDesignResponse] = useState(null);
  const [designState, setDesignState] = useState(null);
  const [modelUrl, setModelUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate3DModel(successfulDesign) {
    const response = await fetch(`${API_URL}/api/gears/spur/model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(successfulDesign),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || `3D model generation failed (${response.status})`
      );
    }

    if (!data.model_url) {
      throw new Error('The backend did not return a model URL.');
    }

    // Change the URL each time to force a fresh model load.
    setModelUrl(
      `${data.model_url}?t=${Date.now()}`
    );
  }

  async function handleGenerate() {
    if (gearType !== 'spur') {
      setError('Helical gear design is not connected to the backend yet.');
      return;
    }

    setLoading(true);
    setError('');
    setDesignResponse(null);
    setDesignState(null);
    setModelUrl(null);

    const requestBody = {
      power: Number(gearData.power),
      pinion_rpm: Number(gearData.pinionSpeed),
      gear_ratio: Number(gearData.gearRatio),
      pressure_angle: Number(gearData.pressureAngle),
      pinion_strength: Number(gearData.pinionStrength),
      gear_strength: Number(gearData.gearStrength),
      service_factor: Number(gearData.serviceFactor),
      bhn: Number(gearData.bhn),
      gear_system: gearData.gearSystem,
      factor_of_safety: Number(gearData.factorOfSafety),
      pinion_modulus: Number(gearData.pinionModulus),
      gear_modulus: Number(gearData.gearModulus),
      face_width_factor: Number(gearData.faceWidthFactor),
    };

    try {
      const response = await fetch(`${API_URL}/api/gears/spur/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || `Request failed with status ${response.status}`
        );
      }

      setDesignResponse(data);
      setDesignState(data);

      // Generate the 3D model only after the design succeeds.
      if (data.status === 'success') {
        await generate3DModel(data);
      }
    } catch (err) {
      setError(
        err.message ||
          'Could not connect to the backend. Check that FastAPI is running.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue(choice, value) {
    if (!designState) return;

    setLoading(true);
    setError('');
    setModelUrl(null);

    try {
      const response = await fetch(`${API_URL}/api/gears/spur/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: designState,
          choice,
          value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || `Request failed with status ${response.status}`
        );
      }

      setDesignResponse(data);
      setDesignState(data);

      // Generate or regenerate the assembly after the final successful retry.
      if (data.status === 'success') {
        await generate3DModel(data);
      }
    } catch (err) {
      setError(err.message || 'Could not continue the gear design.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setGearType('spur');
    setGearData({ ...initialGearData });
    setDesignResponse(null);
    setDesignState(null);
    setModelUrl(null);
    setError('');
    setLoading(false);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">⚙</span>
          <h1>
            Gear Design <span>Studio</span>
          </h1>
        </div>

        <nav className="navigation">
          <button className="nav-item active" type="button">
            ⚙ Design
          </button>
          <button className="nav-item" type="button">
            ▤ Theory
          </button>
          <button className="nav-item" type="button">
            ▧ Gallery
          </button>
          <button className="nav-item" type="button">
            ⓘ About
          </button>
        </nav>
      </header>

      <main className="dashboard">
        <section className="panel input-panel">
          <h2>⚙ Input Parameters</h2>

          <GearForm
            gearType={gearType}
            setGearType={setGearType}
            gearData={gearData}
            setGearData={setGearData}
            onGenerate={handleGenerate}
            onReset={handleReset}
            loading={loading}
          />

          {error && (
            <p role="alert" style={{ color: '#d9534f' }}>
              {error}
            </p>
          )}
        </section>

        <section className="panel results-panel">
          <h2>▤ Design Results</h2>

          <GearResults
            gearType={gearType}
            designResponse={designResponse}
            loading={loading}
            onContinue={handleContinue}
          />
        </section>

        <section className="viewer-section">
          <div className="panel viewer-panel">
            <h2>⬡ 3D Gear Model</h2>

            <GearViewer
              gearType={gearType}
              generated={designResponse?.status === 'success'}
              modelUrl={modelUrl}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
