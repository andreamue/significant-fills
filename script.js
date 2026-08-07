const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQm1AXCBhTs52i0VZScUL753QK5wC_RmAMWIEygF5bBZHr0TywN1LWzMlvbPCyKtnabLihXOQDpA_GX/pub?output=csv';
const MILKYWAY_DISTANCE = 25800; // Light years from Earth to Center of Milky Way

// Text sanitization to prevent XSS
// Really just neutralizes and displays raw text
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[&<>"']/g, (char) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return entities[char];
    })
    .trim();
}

function updateProgressBar(largestFill) {
  const progressFill = document.getElementById('progress-fill');
  const distanceCovered = document.getElementById('distance-covered');

  if (!progressFill || !distanceCovered) return;
  
  const percentage = Math.min((largestFill / MILKYWAY_DISTANCE) * 100, 100);
  const distance = Math.min(largestFill, MILKYWAY_DISTANCE);
  
  progressFill.style.width = `${percentage}%`;
  distanceCovered.textContent = `${distance.toLocaleString()} ly`;
}

function csvToJSON(csv) {
  const lines = csv.split("\n").filter(l => l.trim().length > 0);

  // Replace commas inside double quotes with a placeholder
  const safeLines = lines.map(line =>
    line.replace(/"([^"]*)"/g, (match, group) =>
      `"${group.replace(/,/g, "&#44;")}"`
    )
  );

  const headers = safeLines[0].split(",").map(h => h.trim());
  return safeLines.slice(1).map(line => {
    const values = line.split(",").map(v => sanitizeText(v.replace(/&#44;/g, ",")));
    const entry = {};
    headers.forEach((h, i) => {
      entry[h] = values[i] || '';
    });
    return entry;
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '';
  }
}

function mapData(data){
  // Create a map of usernames to their fills
  const userMap = {};
  data.forEach(entry => {
    const username = entry.Username;
    if (!userMap[username]) {
      userMap[username] = [];
    }
    userMap[username].push(entry);
  });
  return userMap;
}

function calculateStats(data) {
  const stats = {
    totalFills: data.length,
    userCounts: {},
    topUser: null,
    topUserCount: 0,
    largestFill: 0,
    fillsPerWeek: 0
  };

  // Count fills per user and find largest fill number
  data.forEach(entry => {
    const username = entry.Username;
    stats.userCounts[username] = (stats.userCounts[username] || 0) + 1;
    
    // Extract number from SigFill (e.g., "Bottle 42" -> 42)
    const fillMatch = entry.SigFill.match(/\d+/);
    if (fillMatch) {
      const fillNumber = parseInt(fillMatch[0]);
      if (fillNumber > stats.largestFill) {
        stats.largestFill = fillNumber;
      }
    }
  });

  // Find the user with the most fills
  Object.entries(stats.userCounts).forEach(([username, count]) => {
    if (count > stats.topUserCount) {
      stats.topUser = username;
      stats.topUserCount = count;
    }
  });

  // Calculate fills per week (last 4 weeks only)
  if (data.length > 0) {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - (4 * 7 * 24 * 60 * 60 * 1000)); // 4 weeks ago
    
    // Filter fills from the last 4 weeks
    const recentFills = data.filter(entry => {
      const fillDate = new Date(entry.Timestamp);
      return !isNaN(fillDate.getTime()) && fillDate >= fourWeeksAgo;
    });
    
    if (recentFills.length > 0) {
      // Find the highest and lowest bottle numbers from recent fills
      let highestBottle = 0;
      let lowestBottle = Infinity;
      
      recentFills.forEach(entry => {
        const fillMatch = entry.SigFill.match(/\d+/);
        if (fillMatch) {
          const fillNumber = parseInt(fillMatch[0]);
          if (fillNumber > highestBottle) {
            highestBottle = fillNumber;
          }
          if (fillNumber < lowestBottle) {
            lowestBottle = fillNumber;
          }
        }
      });
      
      // Calculate bottles filled in last 4 weeks and divide by 4
      
      const bottlesFilled = highestBottle - lowestBottle;
      stats.fillsPerWeek = parseFloat((recentFills.length/4).toFixed(1)); // Average fills per week
    } else {
      stats.fillsPerWeek = '0.0';
    }
  }

  return stats;
}

function showStats(data) {
  const statsContainer = document.getElementById('stats');
  if (!statsContainer) return;

  const stats = calculateStats(data);
  
  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-title">Total Fills Logged</div>
      <div class="stat-value">${stats.totalFills}</div>
    </div>
    
    <div class="stat-card">
      <div class="stat-title">Most Active Hydrator</div>
      <div class="stat-value">${stats.topUser}</div>
      <div class="stat-detail">${stats.topUserCount} fills logged</div>
    </div>
    
    <div class="stat-card">
      <div class="stat-title">Fills Per Week</div>
      <div class="stat-value">${stats.fillsPerWeek}</div>
      <div class="stat-detail">average rate</div>
    </div>
  `;
  
  // Update progress bar
  updateProgressBar(stats.largestFill);
}

function showData(data) {
  const log = document.getElementById('log');
  if (!log) return;

  log.innerHTML = '';

  // Create a color map for usernames
  const usernameColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  // Get unique usernames and assign colors
  const uniqueUsernames = [...new Set(data.map(entry => entry.Username))];
  const colorMap = {};
  uniqueUsernames.forEach((username, index) => {
    colorMap[username] = usernameColors[index % usernameColors.length];
  });

  const allFills = data.reverse();
  allFills.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'entry';
    const userColor = colorMap[entry.Username];
    div.style.borderLeftColor = userColor;
    const timestamp = formatTimestamp(entry.Timestamp);
    const hasComments = entry.Comments && entry.Comments.trim() !== '';
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <strong style="color: ${userColor}">${entry.Username}</strong> filled the <em>${entry.SigFill}</em> bottle!${hasComments ? `<br/>📝 "${entry.Comments}"` : ''}
        </div>
        ${timestamp ? `<div style="color: #888; font-size: 0.8rem; margin-left: 10px;">${timestamp}</div>` : ''}
      </div>
    `;
    log.appendChild(div);
  });

  // Show statistics
  showStats(data);
}

function showLeaderboard(data) {
  const leaderboardContainer = document.getElementById('leaderboard');
  if (!leaderboardContainer) return;

  const userMap = mapData(data);
  const leaderboardEntries = Object.entries(userMap)
    .map(([username, fills]) => ({ username, count: fills.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 users
  leaderboardContainer.innerHTML = leaderboardEntries.map(entry => `
    <div class="stat-card">
      <div class="stat-title">${entry.username}</div>
      <div class="stat-value">${entry.count}</div>
    </div>
  `).join('');
}

function showUserData(data) {
  const container = document.getElementById('user-data');
  if (!container) return;

  const userMap = mapData(data);
  container.innerHTML = Object.entries(userMap)
    .map(([user, fills]) => `
      <div class="user-section">
        <h3>${sanitizeText(user)} — ${fills.length} fill${fills.length === 1 ? '' : 's'}</h3>
        <div class="user-fills">
          ${fills.map(entry => `
            <div class="entry">
              <strong>${sanitizeText(entry.SigFill)}</strong> - ${formatTimestamp(entry.Timestamp)}${entry.Comments ? `<br/>📝 "${sanitizeText(entry.Comments)}"` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `)
    .join('');
}
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const json = csvToJSON(text);
    showData(json);
    showLeaderboard(json);
    showUserData(json);
  } catch (error) {
    const fallback = document.getElementById('user-data');
    if (fallback) {
      fallback.innerHTML = '<div class="stat-card"><div class="stat-title">Could not load data</div><div class="stat-detail">The fill sheet is unavailable right now. Please try again shortly.</div></div>';
    }
  }
});