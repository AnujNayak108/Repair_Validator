import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function App() {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [impactZone, setImpactZone] = useState('Front Right');

  const pollStatus = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/estimates/${id}`);
      const data = res.data;
      if (data.status === 'completed') {
        setEstimate({
          id: data.id,
          total_cost: data.total_amount || 0,
          vehicle: `${data.vehicle_year || ''} ${data.vehicle_make || ''} ${data.vehicle_model || 'Unknown Vehicle'}`.trim(),
          status: data.status,
          line_items: data.line_items.map((item) => ({
            id: item.id,
            part_name: item.part_name,
            operation: item.operation_type,
            cost: item.unit_price || 0,
            flagged: item.flags && item.flags.length > 0,
            reason: item.flags && item.flags.length > 0 ? item.flags[0].explanation : ""
          }))
        });
        setLoading(false);
      } else if (data.status === 'failed_extraction') {
        alert('Failed to extract data from the PDF.');
        setLoading(false);
      } else if (data.status === 'failed_processing') {
        alert('Failed to process and validate estimate with AI.');
        setLoading(false);
      } else {
        setTimeout(() => pollStatus(id), 2000);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('impact_zone', impactZone);

    try {
      const res = await axios.post(`${API_BASE}/api/v1/estimates/upload`, formData);
      pollStatus(res.data.id);
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert(err.response?.data?.detail || "Error uploading file.");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'application/pdf': ['.pdf']} });

  if (estimate) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="flex items-center justify-between border-b border-white/10 pb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                Estimate {estimate.id}
              </h1>
              <p className="text-sm text-neutral-400 mt-1">{estimate.vehicle} • Impact: {impactZone}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-400">Total Amount</p>
              <p className="text-2xl font-bold text-white">${estimate.total_cost.toFixed(2)}</p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4">
            <h2 className="text-lg font-semibold border-b border-white/10 pb-2">Line Items</h2>
            {estimate.line_items.map((item) => (
              <div key={item.id} className={`p-4 rounded-xl border flex items-start justify-between transition-colors ${item.flagged ? 'bg-rose-950/20 border-rose-900/50' : 'bg-neutral-900/30 border-white/5'}`}>
                <div>
                  <h3 className="font-medium text-neutral-200">{item.part_name}</h3>
                  <div className="flex gap-4 mt-2 text-sm text-neutral-500">
                    <span>{item.operation}</span>
                  </div>
                  {item.flagged && (
                    <div className="mt-3 flex items-start gap-2 text-rose-400 text-sm bg-rose-950/40 p-3 rounded-md">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{item.reason}</p>
                    </div>
                  )}
                </div>
                <div className="text-right font-medium text-neutral-300">
                  ${item.cost.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setEstimate(null)} className="text-sm text-neutral-400 hover:text-white transition-colors">
            ← Upload another estimate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      <div className="max-w-xl w-full space-y-12 text-center">
        <div className="space-y-4 relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-[100px] rounded-full" />
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent relative">
            Repair Validator
          </h1>
          <p className="text-lg text-neutral-400 relative">
            AI-powered anomaly detection for collision repair estimates.
          </p>
        </div>

        <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl relative">
          <div className="mb-6 text-left">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Impact Zone</label>
            <select 
              value={impactZone} 
              onChange={(e) => setImpactZone(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
            >
              <option>Front Right</option>
              <option>Front Left</option>
              <option>Rear Right</option>
              <option>Rear Left</option>
              <option>Front Center</option>
              <option>Rear Center</option>
            </select>
          </div>

          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-10 transition-all cursor-pointer group
              ${isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-neutral-800/50 rounded-full group-hover:scale-110 transition-transform duration-300">
                <UploadCloud className="w-8 h-8 text-neutral-400 group-hover:text-white transition-colors" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-neutral-200">
                  {loading ? 'Uploading & Analyzing...' : 'Click or drag PDF estimate here'}
                </p>
                <p className="text-xs text-neutral-500">
                  Supports CCC ONE, Mitchell, and Audatex formats.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
