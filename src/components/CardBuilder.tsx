import { useState, useRef, useEffect } from 'react';
import { teams } from '../data/teams';
import BaseballCard from './BaseballCard';

const defaultStats = {
  nickname: 'The Baseball King',
  position: 'Designated Viber',
  stats: { AVG: '.342', HR: '24', RBI: '89', SB: '15', OPS: '.892', WAR: '4.2' },
  funFact: 'Once hit a home run while eating a hot dog.',
};

export default function CardBuilder() {
  // Image states
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [stylizedImage, setStylizedImage] = useState<string | null>(null);

  // Form states
  const [playerName, setPlayerName] = useState('');
  const [team, setTeam] = useState('Dodgers');

  // UI states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedStats, setGeneratedStats] = useState(defaultStats);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colors = teams[team];

  // Prevent browser file hijack
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('dragover', preventDefaults);
    document.addEventListener('drop', preventDefaults);

    return () => {
      document.removeEventListener('dragover', preventDefaults);
      document.removeEventListener('drop', preventDefaults);
    };
  }, []);

  // Image processing
  const processImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      console.warn('Not an image:', file.type);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setOriginalImage(reader.result as string);
      setStylizedImage(null);
      setGenerated(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImage(file);
  };

  // Card generation
  const handleGenerate = async () => {
    if (!originalImage || !playerName.trim()) {
      setError('Please upload a photo and provide a player name.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: originalImage,
          team,
          playerName: playerName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Generation failed');
      }

      if (data.stylizedImage) {
        setStylizedImage(data.stylizedImage);
      }

      if (data.stats) {
        setGeneratedStats(data.stats);
      }

      setGenerated(true);
    } catch (err) {
      console.error('API error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }

    setIsGenerating(false);
  };

  // Determine which image to show on the card
  const displayImage = generated && stylizedImage ? stylizedImage : originalImage;

  const displayStats = generated
    ? generatedStats.stats
    : { AVG: '---', HR: '--', RBI: '--', SB: '--', OPS: '---', WAR: '--' };

  return (
    <main className="p-8 flex flex-col lg:flex-row gap-8 items-start justify-center">
      {/* LEFT PANEL: CONTROLS */}
      <div className="bg-gray-800 rounded-xl p-6 w-full lg:w-96 space-y-4">
        <h2 className="text-xl font-bold text-white mb-4">Card Generator</h2>

        {/* IMAGE UPLOAD */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Your Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full py-6 px-4 rounded-lg border-2 border-dashed text-center cursor-pointer transition relative ${
              isDragging
                ? 'bg-blue-600/20 border-blue-400 text-blue-300'
                : 'bg-gray-700 hover:bg-gray-600 border-gray-500 hover:border-gray-400 text-white'
            }`}
          >
            {isDragging ? (
              <span className="text-lg">Drop it here!</span>
            ) : (
              <>
                <span className="block text-lg">
                  {originalImage ? 'Change Photo' : 'Upload Photo'}
                </span>
                <span className="block text-sm text-gray-400 mt-1">or drag and drop</span>
              </>
            )}
          </div>

          {originalImage && (
            <div className="mt-3 rounded-lg overflow-hidden">
              <img src={originalImage} alt="Preview" className="w-full h-32 object-cover" />
            </div>
          )}
        </div>

        {/* NAME INPUT */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name <span className="text-red-400">(required)</span>
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter name..."
            className="w-full py-2 px-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* TEAM SELECT */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Favorite Team</label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full py-2 px-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {Object.keys(teams).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* GENERATE BUTTON */}
        <button
          onClick={handleGenerate}
          disabled={!originalImage || !playerName.trim() || isGenerating}
          className={`w-full py-3 rounded-lg font-bold text-lg transition ${
            !originalImage || !playerName.trim() || isGenerating
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
          }`}
        >
          {isGenerating ? '✨ Stylizing Photo...' : 'Generate Card'}
        </button>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {generated && (
          <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-200 text-sm">
            <strong>Card Generated!</strong>
            <p className="mt-1 text-xs">Your photo has been stylized for the card.</p>
          </div>
        )}

        {generated && (
          <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-200 text-sm">
            <strong>Fun Fact:</strong> {generatedStats.funFact}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: CARD PREVIEW */}
      <div className="flex flex-col items-center gap-6 w-full lg:flex-1">
        <div className="flex flex-col items-center gap-4 w-full">
          <h2 className="text-xl font-bold text-white">
            {generated ? 'Your Baseball Card' : 'Design Preview'}
          </h2>

          {/* Toggle between original and stylized */}
          {generated && stylizedImage && originalImage && (
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setShowOriginal(false)}
                className={`px-4 py-1 rounded-lg text-sm font-medium transition ${
                  !showOriginal
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Stylized
              </button>
              <button
                onClick={() => setShowOriginal(true)}
                className={`px-4 py-1 rounded-lg text-sm font-medium transition ${
                  showOriginal
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Original
              </button>
            </div>
          )}

          {/* The Baseball Card using the existing template */}
          <BaseballCard
            playerImage={showOriginal ? originalImage : displayImage}
            playerName={generated ? generatedStats.nickname : playerName || 'Player Name'}
            team={team}
            colors={colors}
            position={generated ? generatedStats.position : 'TBD'}
            number={String(Math.floor(Math.random() * 98) + 1).padStart(2, '0')}
            stats={displayStats}
          />

          {/* Before & After comparison */}
          {generated && stylizedImage && originalImage && (
            <div className="mt-6 w-full max-w-md bg-gray-900/70 border border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 text-center">
                Before & After
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <figure className="space-y-1">
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full aspect-[3/4] object-cover rounded-lg border border-gray-600"
                  />
                  <figcaption className="text-center text-xs text-gray-400">Original</figcaption>
                </figure>
                <figure className="space-y-1">
                  <img
                    src={stylizedImage}
                    alt="Stylized"
                    className="w-full aspect-[3/4] object-cover rounded-lg border border-blue-600"
                  />
                  <figcaption className="text-center text-xs text-gray-400">AI Stylized</figcaption>
                </figure>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}