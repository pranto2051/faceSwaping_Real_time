import { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, Settings, Download, RefreshCw, Layers } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = 'http://localhost:8000';

function App() {
  const [mode, setMode] = useState('single'); // 'single' | 'batch'
  const [sourceImage, setSourceImage] = useState(null);
  const [targetImage, setTargetImage] = useState(null);
  const [targetImagesBatch, setTargetImagesBatch] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [eta, setEta] = useState(0);
  const [results, setResults] = useState([]);
  const [jobId, setJobId] = useState(null);
  
  const [settings, setSettings] = useState({
    resolution: 'original',
    restorationStrength: 70,
    blendingSmoothness: 20,
    colorMatch: true,
    sharpenFace: true,
    format: 'jpeg'
  });

  const wsRef = useRef(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const onDropSource = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setSourceImage(Object.assign(acceptedFiles[0], {
        preview: URL.createObjectURL(acceptedFiles[0])
      }));
    }
  };

  const onDropTarget = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      if (mode === 'single') {
        setTargetImage(Object.assign(acceptedFiles[0], {
          preview: URL.createObjectURL(acceptedFiles[0])
        }));
      } else {
        const newBatch = acceptedFiles.map(file => Object.assign(file, {
          preview: URL.createObjectURL(file)
        }));
        setTargetImagesBatch(prev => [...prev, ...newBatch].slice(0, 30));
      }
    }
  };

  const { getRootProps: getSourceProps, getInputProps: getSourceInputProps } = useDropzone({
    onDrop: onDropSource,
    accept: {'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'], 'image/webp': ['.webp']},
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024
  });

  const { getRootProps: getTargetProps, getInputProps: getTargetInputProps } = useDropzone({
    onDrop: onDropTarget,
    accept: {'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'], 'image/webp': ['.webp']},
    maxFiles: mode === 'single' ? 1 : 30,
    maxSize: 50 * 1024 * 1024
  });

  const connectWebSocket = (id) => {
    const ws = new WebSocket(`ws://localhost:8000/ws/job/${id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setStatusText(data.step);
      setEta(data.eta_seconds);

      if (data.status === 'completed') {
        setIsProcessing(false);
        fetchResults(id);
      } else if (data.status === 'error') {
        setIsProcessing(false);
        toast.error(`Error: ${data.message}`);
      }
    };
    ws.onerror = () => {
      toast.error('WebSocket connection error');
    };
  };

  const fetchResults = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/api/job/${id}/results`);
      setResults(res.data.results);
    } catch (e) {
      toast.error('Failed to fetch results');
    }
  };

  const handleSubmit = async () => {
    if (!sourceImage) {
      toast.error('Please upload a source image');
      return;
    }
    if (mode === 'single' && !targetImage) {
      toast.error('Please upload a target image');
      return;
    }
    if (mode === 'batch' && targetImagesBatch.length === 0) {
      toast.error('Please upload at least one target image');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusText('Initializing job...');
    setResults([]);

    const formData = new FormData();
    formData.append('source_image', sourceImage);
    formData.append('settings', JSON.stringify(settings));

    let endpoint = '/api/swap/single';
    if (mode === 'single') {
      formData.append('target_image', targetImage);
    } else {
      endpoint = '/api/swap/batch';
      targetImagesBatch.forEach(img => {
        formData.append('target_images', img);
      });
    }

    try {
      const response = await axios.post(`${API_BASE}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const id = response.data.job_id;
      setJobId(id);
      connectWebSocket(id);
    } catch (error) {
      setIsProcessing(false);
      toast.error(error.response?.data?.message || 'Failed to start processing');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const resetAll = () => {
    setSourceImage(null);
    setTargetImage(null);
    setTargetImagesBatch([]);
    setResults([]);
    setProgress(0);
    setStatusText('');
    setJobId(null);
  };

  return (
    <div className="min-h-screen pb-20">
      <ToastContainer position="top-right" theme="colored" />
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-primary p-2 rounded-lg text-white">
              <Layers size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">FaceSwap Studio</h1>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-full">
            <button 
              onClick={() => setMode('single')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === 'single' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Single Photo
            </button>
            <button 
              onClick={() => setMode('batch')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === 'batch' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Batch Processing
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8 space-y-8">
        
        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Source Box */}
              <div className="card p-6 flex flex-col h-[400px]">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                  Source Face
                </h3>
                <div 
                  {...getSourceProps()} 
                  className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 transition-all cursor-pointer
                    ${sourceImage ? 'border-primary/50 bg-primary/5' : 'border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  <input {...getSourceInputProps()} />
                  {sourceImage ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <img src={sourceImage.preview} alt="Source Preview" className="max-h-48 object-contain rounded-lg shadow-sm" />
                      <div className="mt-4 text-center">
                        <p className="text-sm font-medium truncate w-48">{sourceImage.name}</p>
                        <p className="text-xs text-gray-500">{(sourceImage.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drag & drop or click to upload</p>
                      <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG, WEBP up to 50MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Target Box */}
              <div className="card p-6 flex flex-col h-[400px]">
                <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    {mode === 'single' ? 'Target Photo' : 'Target Photos'}
                  </div>
                  {mode === 'batch' && targetImagesBatch.length > 0 && (
                    <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-md">
                      {targetImagesBatch.length} selected
                    </span>
                  )}
                </h3>
                
                {mode === 'single' ? (
                  <div 
                    {...getTargetProps()} 
                    className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 transition-all cursor-pointer
                      ${targetImage ? 'border-primary/50 bg-primary/5' : 'border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    <input {...getTargetInputProps()} />
                    {targetImage ? (
                      <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <img src={targetImage.preview} alt="Target Preview" className="max-h-48 object-contain rounded-lg shadow-sm" />
                        <div className="mt-4 text-center">
                          <p className="text-sm font-medium truncate w-48">{targetImage.name}</p>
                          <p className="text-xs text-gray-500">{(targetImage.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drag & drop or click to upload</p>
                        <p className="text-xs text-gray-500 mt-1">Target scene or body to apply face on</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div 
                      {...getTargetProps()} 
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-all mb-4"
                    >
                      <input {...getTargetInputProps()} />
                      <p className="text-sm font-medium">Click or drop multiple targets here (Max 30)</p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 pr-2">
                      {targetImagesBatch.map((img, idx) => (
                        <div key={idx} className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                          <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Section */}
            {isProcessing && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6"
              >
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Processing Job</h4>
                    <p className="text-sm text-gray-500 mt-1">{statusText}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-primary">{progress}%</span>
                    <p className="text-xs text-gray-500 mt-1">ETA: {eta}s</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out relative" 
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                
                {/* Steps indicator */}
                <div className="mt-4 flex flex-wrap gap-2">
                   {['Face Detection', 'Alignment', 'Face Swap', 'Restoration', 'Color Match', 'Blending', 'Final Render'].map((step, idx) => {
                     const stepProgress = idx * (100 / 7);
                     let state = 'pending';
                     if (progress > stepProgress) state = 'completed';
                     if (progress >= stepProgress && progress < (idx + 1) * (100 / 7)) state = 'active';
                     
                     return (
                       <span key={step} className={`text-xs px-2 py-1 rounded-md border ${
                         state === 'completed' ? 'bg-success/10 text-success border-success/20' : 
                         state === 'active' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' : 
                         'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                       }`}>
                         {step}
                       </span>
                     )
                   })}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            <div className="card p-6 h-[400px] flex flex-col">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={20} className="text-gray-500" />
                Quality Settings
              </h3>
              
              <div className="space-y-5 flex-1 overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Output Resolution</label>
                  <select 
                    value={settings.resolution}
                    onChange={(e) => setSettings({...settings, resolution: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="original">Original</option>
                    <option value="2x">2x Upscale</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium">Restoration Strength</label>
                    <span className="text-xs text-primary">{settings.restorationStrength}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={settings.restorationStrength}
                    onChange={(e) => setSettings({...settings, restorationStrength: Number(e.target.value)})}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-gray-500 mt-1">Balances fidelity vs enhancements</p>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium">Blending Smoothness</label>
                    <span className="text-xs text-primary">{settings.blendingSmoothness}</span>
                  </div>
                  <input 
                    type="range" min="5" max="40" 
                    value={settings.blendingSmoothness}
                    onChange={(e) => setSettings({...settings, blendingSmoothness: Number(e.target.value)})}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">LAB Color Match</label>
                  <input 
                    type="checkbox" 
                    checked={settings.colorMatch}
                    onChange={(e) => setSettings({...settings, colorMatch: e.target.checked})}
                    className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Sharpen Face</label>
                  <input 
                    type="checkbox" 
                    checked={settings.sharpenFace}
                    onChange={(e) => setSettings({...settings, sharpenFace: e.target.checked})}
                    className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Output Format</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSettings({...settings, format: 'jpeg'})}
                      className={`flex-1 py-1.5 text-sm rounded-md border transition-all ${settings.format === 'jpeg' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-gray-300 text-gray-600'}`}
                    >
                      JPEG (97%)
                    </button>
                    <button 
                      onClick={() => setSettings({...settings, format: 'png'})}
                      className={`flex-1 py-1.5 text-sm rounded-md border transition-all ${settings.format === 'png' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-gray-300 text-gray-600'}`}
                    >
                      PNG (Lossless)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={isProcessing}
              className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <><RefreshCw className="animate-spin" /> Processing...</>
              ) : (
                <>Start Face Swap <span className="text-xs font-normal opacity-80">(Ctrl+Enter)</span></>
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle className="text-success" />
                  Processing Complete
                </h3>
                <div className="flex gap-3">
                  <button onClick={resetAll} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Reset / New Swap
                  </button>
                  {results.length > 1 && (
                    <a 
                      href={`${API_BASE}/api/job/${jobId}/download-zip`}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Download size={16} />
                      Download All (ZIP)
                    </a>
                  )}
                </div>
              </div>

              <div className={`grid gap-6 ${results.length > 1 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:w-1/2 md:mx-auto'}`}>
                {results.map((res, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800">
                    <div className="aspect-[4/5] relative group bg-gray-200">
                      <img src={`${API_BASE}${res.url}`} alt="Result" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a href={`${API_BASE}${res.url}`} download className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all">
                          <Download size={16} />
                          Download
                        </a>
                      </div>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <p className="text-sm font-medium truncate w-4/5" title={res.filename}>{res.filename}</p>
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">High-Res</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}

export default App;
