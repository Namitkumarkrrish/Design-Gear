
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
      setModelError(err.message || 'The 3D model could not be generated.');
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
  const isHelical = gearType === 'helical';

  function scrollToDesign() {
    document.getElementById('design-workspace')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            ⚙
          </span>

          <h1>
            Gear Design <span>Studio</span>
          </h1>
        </div>

        <nav className="navigation" aria-label="Main navigation">
          <button
            className="nav-item active"
            type="button"
            onClick={scrollToDesign}
          >
            ⚙ Design
          </button>

          <button
            className="nav-item"
            type="button"
            onClick={() =>
              document.getElementById('design-theory')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          >
            ▤ Theory
          </button>

          <button
            className="nav-item"
            type="button"
            onClick={() =>
              document.getElementById('gear-model')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          >
            ▧ Gallery
          </button>

          <button
            className="nav-item"
            type="button"
            onClick={() =>
              document.getElementById('studio-footer')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          >
            ⓘ About
          </button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            {isHelical
              ? 'Helical gears · Bending & wear'
              : 'Spur gears · Lewis & Buckingham'}
          </div>

          <h2>
            Engineered gears,
            <br />
            specs to <span>solid model.</span>
          </h2>

          <p className="hero-description">
            From power and speed to a fully calculated gear design. Define your
            operating conditions, verify the engineering parameters, and
            generate a 3D model ready to inspect.
          </p>
        </div>

        <div className="hero-steps" aria-label="Design process">
          <div className="hero-step">
            <span className="step-number">01</span>
            <span className="step-text">
              <strong>Specify</strong>
              <small>Enter operating conditions</small>
            </span>
          </div>

          <div className="hero-step">
            <span className="step-number">02</span>
            <span className="step-text">
              <strong>Verify</strong>
              <small>Calculate and review results</small>
            </span>
          </div>

          <div className="hero-step">
            <span className="step-number">03</span>
            <span className="step-text">
              <strong>Visualise</strong>
              <small>Inspect the generated 3D model</small>
            </span>
          </div>
        </div>
      </section>

      <div className="dashboard-heading" id="design-workspace">
        <div>
          <h2>Design workspace</h2>
          <p>Configure, calculate, and inspect your gear design.</p>
        </div>

        <span className="dashboard-index">
          ENGINEERING / {isHelical ? 'HELICAL' : 'SPUR'}
        </span>
      </div>

      <main className="dashboard">
        <section className="panel input-panel" id="design-theory">
          <h2>
            <span className="panel-number">01 /</span>
            Input Parameters
          </h2>

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
            <p className="panel-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="panel results-panel">
          <h2>
            <span className="panel-number">02 /</span>
            Design Results
          </h2>

          <GearResults
            gearType={gearType}
            designResponse={designResponse}
            loading={loading || modelLoading}
            onContinue={handleContinue}
          />
        </section>

        <section className="viewer-section" id="gear-model">
          <div className="panel viewer-panel">
            <h2>
              <span className="panel-number">03 /</span>
              3D Gear Model
            </h2>

            <GearViewer
              gearType={gearType}
              generated={designSucceeded}
              modelUrl={modelUrl}
            />

            {modelLoading && (
              <p className="viewer-loading" role="status">
                Generating your 3D model…
              </p>
            )}

            {modelError && (
              <p className="panel-error" role="alert">
                Model generation failed: {modelError}
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="footer" id="studio-footer">
        <span>GEAR DESIGN STUDIO</span>
        <span>MECHANICAL DESIGN · CALCULATION · VISUALISATION</span>
      </footer>
    </div>
  );
}

export default App;
