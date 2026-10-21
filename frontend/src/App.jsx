
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
  helixAngle: 23,
  pinionStrength: 580,
  gearStrength: 750,
  serviceFactor: 1.5,
  wearFactor: 1.25,
  bhn: 350,
  gearSystem: '20fdi',
  factorOfSafety: 2,
  pinionModulus: 210000,
  gearModulus: 210000,
  faceWidthFactor: 12,
};

function App() {
  const [gearType, setGearType] = useState('spur');
  const [gearData, setGearData] = useState({ ...initialGearData });

  const [designResponse, setDesignResponse] = useState(null);
  const [designState, setDesignState] = useState(null);
  const [modelUrl, setModelUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState('');
  const [modelError, setModelError] = useState('');

  async function requestJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || `Request failed with status ${response.status}`
      );
    }

    return data;
  }

  async function generate3DModel(successfulDesign, type) {
    setModelLoading(true);
    setModelError('');
    setModelUrl(null);

    try {
      const endpoint =
        type === 'helical'
          ? '/api/gears/helical/model'
          : '/api/gears/spur/model';

      const data = await requestJson(
        `${API_URL}${endpoint}`,
        successfulDesign
      );

      if (!data.model_url) {
        throw new Error('The backend did not return a model URL.');
      }

      setModelUrl(`${data.model_url}?t=${Date.now()}`);
    } catch (err) {
      setModelError(
        err.message || 'The 3D model could not be generated.'
      );
    } finally {
      setModelLoading(false);
    }
  }

  function buildDesignRequest() {
    const requestBody = {
      power: Number(gearData.power),
      pinion_rpm: Number(gearData.pinionSpeed),
      gear_ratio: Number(gearData.gearRatio),
      pressure_angle: Number(gearData.pressureAngle),
      pinion_strength: Number(gearData.pinionStrength),
      gear_strength: Number(gearData.gearStrength),
      service_factor: Number(gearData.serviceFactor),
      bhn: Number(gearData.bhn),
      factor_of_safety: Number(gearData.factorOfSafety),
      pinion_modulus: Number(gearData.pinionModulus),
      gear_modulus: Number(gearData.gearModulus),
      face_width_factor: Number(gearData.faceWidthFactor),
    };

    if (gearType === 'helical') {
      requestBody.helix_angle = Number(gearData.helixAngle);
      requestBody.wear_factor = Number(gearData.wearFactor);
    } else {
      requestBody.gear_system = gearData.gearSystem;
    }

    return requestBody;
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setModelError('');
    setDesignResponse(null);
    setDesignState(null);
    setModelUrl(null);

    try {
      const endpoint =
        gearType === 'helical'
          ? '/api/gears/helical/start'
          : '/api/gears/spur/start';

      const data = await requestJson(
        `${API_URL}${endpoint}`,
        buildDesignRequest()
      );

      setDesignResponse(data);
      setDesignState(data);

      if (data.status === 'success') {
        await generate3DModel(data, gearType);
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
    setModelError('');
    setModelUrl(null);

    try {
      const endpoint =
        gearType === 'helical'
          ? '/api/gears/helical/continue'
          : '/api/gears/spur/continue';

      const data = await requestJson(`${API_URL}${endpoint}`, {
        state: designState,
        choice,
        value,
      });

      setDesignResponse(data);
      setDesignState(data);

      if (data.status === 'success') {
        await generate3DModel(data, gearType);
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
    setModelError('');
    setLoading(false);
    setModelLoading(false);
  }

  function handleGearTypeChange(nextType) {
    setGearType(nextType);
    setDesignResponse(null);
    setDesignState(null);
    setModelUrl(null);
    setError('');
    setModelError('');
  }

  const designSucceeded = designResponse?.status === 'success';

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
            setGearType={handleGearTypeChange}
            gearData={gearData}
            setGearData={setGearData}
            onGenerate={handleGenerate}
            onReset={handleReset}
            loading={loading || modelLoading}
          />

          {error && (
            <p role="alert" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}
        </section>

        <section className="panel results-panel">
          <h2>▤ Design Results</h2>

          <GearResults
            gearType={gearType}
            designResponse={designResponse}
            loading={loading || modelLoading}
            onContinue={handleContinue}
          />
        </section>

        <section className="viewer-section">
          <div className="panel viewer-panel">
            <h2>⬡ 3D Gear Model</h2>

            <GearViewer
              gearType={gearType}
              generated={designSucceeded}
              modelUrl={modelUrl}
            />

            {modelLoading && (
              <p style={{ padding: '0 16px 16px' }}>
                Generating 3D model...
              </p>
            )}

            {modelError && (
              <p
                role="alert"
                style={{
                  padding: '0 16px 16px',
                  color: '#ef4444',
                }}
              >
                Model generation failed: {modelError}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
