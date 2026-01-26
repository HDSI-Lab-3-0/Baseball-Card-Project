import { useState, useRef, useEffect } from 'react';
import { teams } from '../data/teams';
import BaseballCard from './BaseballCard';

const sampleStats = {
  nickname: 'The Snack King',
  position: 'Designated Viber',
  stats: { AVG: '.342', HR: '24', RBI: '89', VIBES: '💯', DRIP: '95', CLUTCH: '88%' },
  funFact: 'Once hit a home run while eating a hot dog.',
};

export default function CardBuilder() {
  const [playerImage, setPlayerImage] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [team, setTeam] = useState('Dodgers');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colors = teams[team];

  /* ================================
     PREVENT BROWSER FILE HIJACK
  ================================= */
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

  /* ================================
     IMAGE PROCESSING
  ================================= */
  const processImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      console.warn('Not an image:', file.type);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPlayerImage(reader.result as string);
      setGenerated(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  /* ================================
     DRAG & DROP HANDLERS
  ================================= */
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

  /* ================================
     CARD GENERATION
  ================================= */
  const handleGenerate = async () => {
    if (!playerImage) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: playerImage,
          team,
          playerName: playerName || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.stats) {
        sampleStats.nickname = data.stats.nickname;
        sampleStats.position = data.stats.position;
        sampleStats.stats = data.stats.stats;
        sampleStats.funFact = data.stats.funFact;
      }
    } catch (err) {
      console.error('API error:', err);
    }

    setIsGenerating(false);
    setGenerated(true);
  };

  const displayStats = generated
    ? sampleStats.stats
    : { AVG: '---', HR: '--', RBI: '--', VIBES: '???', DRIP: '--', CLUTCH: '--' };

  /* ================================
     RENDER
  ================================= */
  return (
    <main className="p-8 flex flex-col lg:flex-row gap-8 items-start justify-center">
      <div className="bg-gray-800 rounded-xl p-6 w-full lg:w-96 space-y-4">
        <h2 className="text-xl font-bold text-white mb-4">⚾ Card Generator</h2>

        {/* IMAGE UPLOAD / DROP ZONE */}
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
              <span className="text-lg">📥 Drop it here!</span>
            ) : (
              <>
                <span className="block text-lg">
                  {playerImage ? '📸 Change Photo' : '📸 Upload Photo'}
                </span>
                <span className="block text-sm text-gray-400 mt-1">
                  or drag and drop
                </span>
              </>
            )}
          </div>

          {playerImage && (
            <div className="mt-3 rounded-lg overflow-hidden">
              <img
                src={playerImage}
                alt="Preview"
                className="w-full h-32 object-cover"
              />
            </div>
          )}
        </div>

        {/* NAME INPUT */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name <span className="text-gray-500">(optional)</span>
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
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Favorite Team
          </label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full py-2 px-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {Object.keys(teams).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* GENERATE BUTTON */}
        <button
          onClick={handleGenerate}
          disabled={!playerImage || isGenerating}
          className={`w-full py-3 rounded-lg font-bold text-lg transition ${
            !playerImage || isGenerating
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
          }`}
        >
          {isGenerating ? 'Generating…' : '✨ Generate Card'}
        </button>

        {generated && (
          <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-200 text-sm">
            <strong>Fun Fact:</strong> {sampleStats.funFact}
          </div>
        )}
      </div>

      {/* CARD PREVIEW */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-xl font-bold text-white">Your Card</h2>
        <BaseballCard
          playerImage={playerImage}
          playerName={generated ? sampleStats.nickname : playerName || 'Player Name'}
          team={team}
          colors={colors}
          position={generated ? sampleStats.position : 'TBD'}
          number="42"
          stats={displayStats}
        />
      </div>
    </main>
  );
}
