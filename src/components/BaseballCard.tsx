//baseballcard.tsx
// Import the TeamColors type definition from our data file
import type { TeamColors } from '../data/teams';

// Define the props interface - these are all the values this component accepts
interface Props {
  playerImage: string | null;      // Base64 image string or null if no image
  playerName: string;               // Player's display name
  team: string;                     // Team name (e.g., "Dodgers")
  colors: TeamColors;               // Object containing primary, secondary, accent colors
  position: string;                 // Player position (e.g., "Designated Viber")
  number: string;                   // Jersey number
  stats: Record<string, string>;    // Key-value pairs of stats (e.g., { AVG: ".342", HR: "24" })
}

// Main component function - receives props and returns JSX
export default function BaseballCard({ playerImage, playerName, team, colors, position, number, stats }: Props) {
  return (
    // ===== MAIN CARD CONTAINER =====
    // The outer wrapper - sets card dimensions and applies gradient background
    <div
      className="relative w-80 h-[32rem] rounded-xl overflow-hidden shadow-2xl"
      // relative: allows absolute positioning of children
      // w-80: width of 320px
      // h-[32rem]: height of 512px (custom Tailwind value)
      // rounded-xl: large border radius for rounded corners
      // overflow-hidden: clips any content that extends beyond the card
      // shadow-2xl: large drop shadow for depth effect
      style={{
        // Dynamic gradient using team colors - goes from top-left to bottom-right
        background: `linear-gradient(145deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      }}
    >
      {/* ===== DECORATIVE BORDER FRAME ===== */}
      {/* Outer border - creates the main frame effect */}
      <div
        className="absolute inset-2 rounded-lg border-4"
        // absolute: positions relative to parent
        // inset-2: 8px from all edges (top, right, bottom, left)
        // rounded-lg: rounded corners
        // border-4: 4px thick border
        style={{ borderColor: colors.accent }}  // Border uses team's accent color
      >
        {/* Inner border - creates a double-frame effect */}
        <div
          className="absolute inset-1 rounded border-2"
          // inset-1: 4px from edges of parent (the outer border)
          // border-2: 2px thick border
          style={{ borderColor: `${colors.accent}66` }}  // 66 = 40% opacity in hex
        />
      </div>

      {/* ===== TEAM NAME HEADER ===== */}
      {/* Horizontal bar with team name at the top */}
      <div
        className="absolute top-4 left-0 right-0 text-center py-1"
        // top-4: 16px from top
        // left-0 right-0: stretches full width
        // text-center: centers the text
        // py-1: 4px vertical padding
        style={{ 
          // Gradient that fades in from transparent, shows color in middle, fades out
          background: `linear-gradient(90deg, transparent, ${colors.accent}22, transparent)` 
          // 22 = ~13% opacity - subtle background highlight
        }}
      >
        <span
          className="text-lg font-black tracking-widest uppercase"
          // text-lg: larger font size
          // font-black: heaviest font weight (900)
          // tracking-widest: maximum letter spacing
          // uppercase: ALL CAPS
          style={{ 
            color: colors.accent,  // Team accent color for text
            textShadow: `2px 2px 4px ${colors.secondary}`  // Shadow for depth/readability
          }}
        >
          {team}  {/* Display the team name */}
        </span>
      </div>

      {/* ===== PLAYER IMAGE CONTAINER ===== */}
      {/* The main photo area */}
      <div
        className="absolute top-14 left-6 right-6 h-56 rounded-lg overflow-hidden bg-gray-800 border-2"
        // top-14: 56px from top (below the team name)
        // left-6 right-6: 24px margins on sides
        // h-56: 224px height for the image area
        // rounded-lg: rounded corners
        // overflow-hidden: clips the image to fit the container
        // bg-gray-800: dark background (visible when no image)
        // border-2: 2px border around the image
        style={{ borderColor: colors.accent }}
      >
        {/* Conditional rendering: show image if exists, otherwise show placeholder */}
        {playerImage ? (
          // If we have an image, display it
          <img 
            src={playerImage}           // The base64 image data
            alt={playerName}            // Accessibility text
            className="w-full h-full object-cover"
            // w-full h-full: fills the container
            // object-cover: scales image to cover area, cropping if needed
          />
        ) : (
          // If no image, show a placeholder icon
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            {/* flex items-center justify-center: centers the icon */}
            {/* SVG icon of a generic person silhouette */}
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        )}
      </div>

      {/* ===== JERSEY NUMBER BADGE ===== */}
      {/* Circular badge in top-right showing player number */}
      <div
        className="absolute top-12 right-4 w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-lg"
        // top-12 right-4: positioned in upper right
        // w-10 h-10: 40px × 40px circle
        // rounded-full: makes it a perfect circle
        // flex items-center justify-center: centers the number
        // font-black text-lg: bold, larger text
        // shadow-lg: drop shadow for depth
        style={{ 
          backgroundColor: colors.secondary,  // Fill color
          color: colors.accent,               // Text color
          border: `2px solid ${colors.accent}` // Border around circle
        }}
      >
        {number}  {/* Display the jersey number */}
      </div>

      {/* ===== PLAYER NAME & POSITION BOX ===== */}
      {/* Card showing player name and position below the image */}
      <div
        className="absolute top-[18.5rem] left-4 right-4 py-2 px-3 rounded-lg text-center"
        // top-[18.5rem]: 296px from top (custom value to position below image)
        // left-4 right-4: 16px margins on sides
        // py-2 px-3: padding inside the box
        // rounded-lg: rounded corners
        // text-center: centers the text
        style={{ 
          backgroundColor: colors.secondary,  // Box background
          border: `2px solid ${colors.accent}` // Border around box
        }}
      >
        {/* Player name - large and prominent */}
        <div 
          className="text-lg font-black uppercase tracking-wide truncate" 
          // truncate: adds "..." if name is too long
          style={{ color: colors.accent }}
        >
          {playerName || 'Player Name'}  {/* Show name or default text */}
        </div>
        {/* Position - smaller text below name */}
        <div 
          className="text-xs font-bold" 
          style={{ color: `${colors.accent}aa` }}  // aa = ~67% opacity for subtle look
        >
          {position}
        </div>
      </div>

      {/* ===== STATS GRID ===== */}
      {/* Bottom section showing all the player stats */}
      <div
        className="absolute bottom-9 left-4 right-4 rounded-lg p-2"
        // bottom-3: 12px from bottom
        // left-4 right-4: 16px margins on sides
        // p-2: 8px padding inside
        style={{ 
          backgroundColor: `${colors.accent}11`,  // 11 = ~7% opacity - very subtle background
          border: `1px solid ${colors.accent}44`  // 44 = ~27% opacity - subtle border
        }}
      >
        {/* Grid layout for stats - 3 columns */}
        <div className="grid grid-cols-3 gap-1 text-center">
          {/* Loop through each stat and display it */}
          {Object.entries(stats).map(([key, value]) => (
            // Object.entries converts { AVG: ".342" } to [["AVG", ".342"]]
            // We destructure each entry into [key, value]
            <div key={key}>  {/* key prop required for React lists */}
              {/* Stat label (e.g., "AVG", "HR") */}
              <div 
                className="text-xs uppercase font-bold" 
                style={{ color: `${colors.accent}88` }}  // 88 = ~53% opacity
              >
                {key}
              </div>
              {/* Stat value (e.g., ".342", "24") */}
              <div 
                className="text-sm font-black" 
                style={{ color: colors.accent }}  // Full opacity for emphasis
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== CORNER DECORATIONS ===== */}
      {/* Four L-shaped corner pieces for visual flair */}
      
      {/* Top-left corner */}
      <div 
        className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 rounded-tl" 
        // border-t-2 border-l-2: only top and left borders (L-shape)
        // rounded-tl: rounds the top-left corner
        style={{ borderColor: colors.accent }} 
      />
      
      {/* Top-right corner */}
      <div 
        className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 rounded-tr" 
        style={{ borderColor: colors.accent }} 
      />
      
      {/* Bottom-left corner */}
      <div 
        className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 rounded-bl" 
        style={{ borderColor: colors.accent }} 
      />
      
      {/* Bottom-right corner */}
      <div 
        className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 rounded-br" 
        style={{ borderColor: colors.accent }} 
      />
    </div>
  );
}
