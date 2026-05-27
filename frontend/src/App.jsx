import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, ShieldCheck, ArrowLeft, Loader2, Sparkles, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function App() {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [impactZone, setImpactZone] = useState('Front Right');
  const [error, setError] = useState(null);

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
        setError('Failed to extract data from the PDF. Please check the file format.');
        setLoading(false);
      } else if (data.status === 'failed_processing') {
        setError('Failed to process and validate estimate with AI.');
        setLoading(false);
      } else {
        setTimeout(() => pollStatus(id), 2000);
      }
    } catch (err) {
      console.error(err);
      setError('Connection error while fetching results.');
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('impact_zone', impactZone);

    try {
      const res = await axios.post(`${API_BASE}/api/v1/estimates/upload`, formData);
      pollStatus(res.data.id);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError(err.response?.data?.detail || "Error uploading file.");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: {'application/pdf': ['.pdf']},
    disabled: loading
  });

  if (estimate) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans selection:bg-indigo-500/30">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto space-y-8"
        >
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
            <div className="space-y-2">
              <button 
                onClick={() => setEstimate(null)} 
                className="group flex items-center text-sm font-medium text-neutral-400 hover:text-white transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Upload
              </button>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <ShieldCheck className="w-8 h-8 text-indigo-400" />
                </div>
                Analysis Complete
              </h1>
              <p className="text-neutral-400 font-medium">
                {estimate.vehicle} <span className="mx-2">•</span> 
                <span className="text-indigo-300">Impact Zone: {impactZone}</span>
              </p>
            </div>
            <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm shadow-xl md:text-right">
              <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-1">Total Authorized Amount</p>
              <p className="font-heading text-4xl font-extrabold text-white">
                ${estimate.total_cost.toFixed(2)}
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4">
            <h2 className="font-heading text-xl font-semibold flex items-center gap-2 mb-2 text-neutral-200">
              <FileText className="w-5 h-5 text-indigo-400" />
              Line Items Reviewed
            </h2>
            
            <AnimatePresence>
              {estimate.line_items.map((item, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={item.id} 
                  className={cn(
                    "p-5 rounded-2xl border flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all duration-300 shadow-lg backdrop-blur-sm",
                    item.flagged 
                      ? "bg-rose-950/20 border-rose-900/50 hover:bg-rose-950/30 hover:border-rose-800/60" 
                      : "bg-neutral-900/40 border-white/5 hover:bg-neutral-900/60 hover:border-white/10"
                  )}
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      {item.flagged ? (
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      )}
                      <h3 className="font-heading font-medium text-lg text-neutral-100">{item.part_name}</h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 text-xs font-medium bg-neutral-800 text-neutral-300 rounded-full border border-white/5">
                        {item.operation}
                      </span>
                    </div>

                    {item.flagged && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 flex items-start gap-2 text-rose-300 text-sm bg-rose-950/40 p-3.5 rounded-xl border border-rose-900/30"
                      >
                        <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                        <p className="leading-relaxed font-medium">{item.reason}</p>
                      </motion.div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-heading font-semibold text-xl text-neutral-200">
                      ${item.cost.toFixed(2)}
                    </div>
                    {item.flagged && (
                      <span className="text-xs font-medium text-rose-400 bg-rose-950/50 px-2 py-1 rounded-md mt-1 inline-block">Flagged for Review</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-xl w-full space-y-12 text-center relative z-10"
      >
        <div className="space-y-5">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-2"
          >
            <ShieldCheck className="w-10 h-10 text-indigo-400" />
          </motion.div>
          <h1 className="font-heading text-5xl md:text-6xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-br from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
              Repair Validator
            </span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 font-medium max-w-md mx-auto">
            AI-powered anomaly detection for collision repair estimates.
          </p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-neutral-900/60 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl space-y-6"
        >
          {error && (
            <div className="bg-rose-950/50 border border-rose-900/50 p-4 rounded-xl flex items-start gap-3 text-left">
              <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-300">{error}</p>
            </div>
          )}

          <div className="text-left space-y-2 relative z-20">
            <label className="block text-sm font-semibold text-neutral-300">
              Select Impact Zone
            </label>
            <div className="relative">
              <select 
                value={impactZone} 
                onChange={(e) => setImpactZone(e.target.value)}
                disabled={loading}
                className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option>Front Right</option>
                <option>Front Left</option>
                <option>Rear Right</option>
                <option>Rear Left</option>
                <option>Front Center</option>
                <option>Rear Center</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          <div 
            {...getRootProps()} 
            className={cn(
              "border-2 border-dashed rounded-2xl p-10 md:p-14 transition-all duration-300 ease-in-out relative overflow-hidden group",
              loading ? "opacity-50 cursor-not-allowed border-white/10" : "cursor-pointer",
              isDragActive ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]" : "border-white/10 hover:border-indigo-500/50 hover:bg-white/[0.02] hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]"
            )}
          >
            <input {...getInputProps()} />
            
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center space-y-4"
                >
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                  <p className="text-sm font-semibold text-indigo-300">
                    Analyzing Estimate with AI...
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center space-y-4"
                >
                  <div className="p-5 bg-neutral-800/50 rounded-full group-hover:bg-indigo-500/10 group-hover:scale-110 transition-all duration-300 shadow-inner">
                    <UploadCloud className="w-10 h-10 text-neutral-400 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold text-neutral-200">
                      Click or drag PDF estimate here
                    </p>
                    <p className="text-xs font-medium text-neutral-500">
                      Supports CCC ONE, Mitchell, and Audatex formats
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default App;
