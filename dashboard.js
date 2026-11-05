function renderDashboard() {
  const container = document.getElementById("dashboardContent");
  
  let html = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <h2 class="text-2xl font-black text-white mb-4">Games</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  `;

  state.games.forEach(game => {
    html += renderGameCard(game);
  });

  html += `
        </div>
      </div>
      <div>
        <h2 class="text-2xl font-black text-white mb-4">Live Activity</h2>
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl">
          ${renderLiveActivity()}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderGameCard(game) {
  const teamCount = game.participantIds.length;
  const hasDraw = game.seeds.length > 0;
  const hasFixtures = game.fixtures !== null;
  
  // Calculate progress
  let progressText = "Not started";
  let progressPercent = 0;
  let currentRound = "";
  
  if (hasFixtures && game.fixtures.rounds) {
    const totalMatches = game.fixtures.rounds.reduce((sum, r) => sum + r.matches.length, 0);
    const completedMatches = game.fixtures.rounds.reduce((sum, r) => 
      sum + r.matches.filter(m => m.result && m.result.scoreA !== null && m.result.scoreB !== null).length, 0);
    
    progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
    progressText = completedMatches + " / " + totalMatches + " matches";
    
    // Find current round
    for (const round of game.fixtures.rounds) {
      const hasIncomplete = round.matches.some(m => !m.result || m.result.scoreA === null || m.result.scoreB === null);
      if (hasIncomplete) {
        currentRound = round.name;
        break;
      }
    }
    if (!currentRound && progressPercent === 100) {
      currentRound = "Completed";
    }
  }
  
  // Get top teams preview
  let topTeamsHtml = "";
  if (hasFixtures) {
    let topTeams = [];
    
    if (game.fixtures.type === "groupStage" && game.groups) {
      const allStandings = calculateGroupStandings(game);
      allStandings.forEach(groupData => {
        if (groupData.standings.length > 0) {
          topTeams.push({
            name: groupData.standings[0].name,
            groupName: groupData.groupName,
            points: groupData.standings[0].points
          });
        }
      });
      topTeams = topTeams.slice(0, 3);
    } else if (game.fixtures.type === "roundRobin") {
      const standings = calculateRoundRobinStandings(game);
      topTeams = standings.slice(0, 3).map(t => ({ name: t.name, points: t.points }));
    } else if (game.fixtures.type === "knockout") {
      // For knockout, show teams that have advanced furthest
      const lastRound = game.fixtures.rounds[game.fixtures.rounds.length - 1];
      if (lastRound && lastRound.matches.length === 1) {
        const final = lastRound.matches[0];
        if (final.result && final.result.scoreA !== null && final.result.scoreB !== null) {
          const winner = final.result.scoreA > final.result.scoreB ? final.teamA : final.teamB;
          if (!winner.placeholder) {
            topTeams.push({ name: winner.name, points: "Champion" });
          }
        }
      }
    }
    
    if (topTeams.length > 0) {
      topTeamsHtml = `
        <div class="mt-3 pt-3 border-t border-gray-700">
          <p class="text-xs text-gray-400 mb-2">Top Teams</p>
          <div class="space-y-1">
      `;
      topTeams.forEach((team, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
        const pointsText = team.points === "Champion" ? "Champion" : team.points + " pts";
        const groupText = team.groupName ? " (" + team.groupName + ")" : "";
        topTeamsHtml += `
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-200">${medal} ${esc(team.name)}${groupText}</span>
            <span class="text-amber-400 font-bold">${pointsText}</span>
          </div>
        `;
      });
      topTeamsHtml += `</div></div>`;
    }
  }
  
  // Format badge
  const formatLabels = {
    knockout: "Knockout",
    roundRobin: "Round Robin",
    groupStage: "Group Stage"
  };
  const formatColors = {
    knockout: "bg-red-900 text-red-300",
    roundRobin: "bg-blue-900 text-blue-300",
    groupStage: "bg-purple-900 text-purple-300"
  };
  
  // Status indicator
  let statusColor = "bg-gray-600";
  let statusText = "Not Started";
  if (progressPercent === 100) {
    statusColor = "bg-green-600";
    statusText = "Completed";
  } else if (progressPercent > 0) {
    statusColor = "bg-amber-600";
    statusText = "In Progress";
  }
  
  return `
    <div class="game-card bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl" onclick="showGameDetail('${game.id}')">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-xl font-black text-white">${esc(game.name)}</h3>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs ${formatColors[game.format]} px-2 py-1 rounded-full font-semibold">
              ${formatLabels[game.format]}
            </span>
            <span class="inline-flex items-center gap-1 text-xs ${statusColor} text-white px-2 py-1 rounded-full">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
              ${statusText}
            </span>
          </div>
        </div>
      </div>
      
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-400">Teams</span>
          <span class="font-bold text-white">${teamCount}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Progress</span>
          <span class="font-bold text-white">${progressText}</span>
        </div>
        ${currentRound ? `
          <div class="flex justify-between">
            <span class="text-gray-400">Current</span>
            <span class="font-bold text-blue-400">${esc(currentRound)}</span>
          </div>
        ` : ""}
      </div>
      
      <div class="mt-3 bg-gray-800 rounded-lg p-2">
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span>Completion</span>
          <span>${progressPercent}%</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2">
          <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all" style="width: ${progressPercent}%"></div>
        </div>
      </div>
      
      ${topTeamsHtml}
      
      <div class="mt-4 flex justify-end">
        <span class="text-xs text-blue-400 font-semibold">View Details →</span>
      </div>
    </div>
  `;
}

function renderLiveActivity() {
  const activities = [];
  
  // Collect completed matches from all games
  state.games.forEach(game => {
    if (!game.fixtures || !game.fixtures.rounds) return;
    
    game.fixtures.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.result && match.result.scoreA !== null && match.result.scoreB !== null) {
          const teamA = match.teamA.bye ? "BYE" : match.teamA.name;
          const teamB = match.teamB.bye ? "BYE" : match.teamB.name;
          
          activities.push({
            type: "completed",
            gameName: game.name,
            gameId: game.id,
            roundName: round.name,
            teamA: teamA,
            teamB: teamB,
            scoreA: match.result.scoreA,
            scoreB: match.result.scoreB,
            winner: match.result.scoreA > match.result.scoreB ? teamA : 
                    match.result.scoreB > match.result.scoreA ? teamB : "Draw"
          });
        } else if (!match.bye && (!match.result || match.result.scoreA === null)) {
          // Upcoming match
          const teamA = match.teamA.placeholder ? match.teamA.name : match.teamA.name;
          const teamB = match.teamB.placeholder ? match.teamB.name : match.teamB.name;
          
          activities.push({
            type: "upcoming",
            gameName: game.name,
            gameId: game.id,
            roundName: round.name,
            teamA: teamA,
            teamB: teamB
          });
        }
      });
    });
  });
  
  if (activities.length === 0) {
    return '<p class="text-gray-500 text-center py-8 text-sm">No activity yet. Games will appear here once draws are made.</p>';
  }
  
  // Sort: completed first (most recent first), then upcoming
  const completed = activities.filter(a => a.type === "completed").slice(0, 10);
  const upcoming = activities.filter(a => a.type === "upcoming").slice(0, 5);
  
  let html = "";
  
  if (completed.length > 0) {
    html += `
      <div class="mb-4">
        <h3 class="text-sm font-bold text-green-400 mb-2">✓ Recent Results</h3>
        <div class="space-y-2">
    `;
    completed.forEach(activity => {
      html += `
        <div class="activity-item bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-green-500" onclick="showGameDetail('${activity.gameId}')">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-purple-400 font-semibold">${esc(activity.gameName)}</span>
            <span class="text-xs text-gray-500">${esc(activity.roundName)}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="font-semibold text-white">${esc(activity.teamA)}</span>
            <span class="font-black text-lg text-green-400">${activity.scoreA} - ${activity.scoreB}</span>
            <span class="font-semibold text-white">${esc(activity.teamB)}</span>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  if (upcoming.length > 0) {
    html += `
      <div>
        <h3 class="text-sm font-bold text-amber-400 mb-2">⏳ Upcoming</h3>
        <div class="space-y-2">
    `;
    upcoming.forEach(activity => {
      html += `
        <div class="activity-item bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-amber-500" onclick="showGameDetail('${activity.gameId}')">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-purple-400 font-semibold">${esc(activity.gameName)}</span>
            <span class="text-xs text-gray-500">${esc(activity.roundName)}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-300">${esc(activity.teamA)}</span>
            <span class="text-xs text-gray-500">vs</span>
            <span class="text-gray-300">${esc(activity.teamB)}</span>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  
  return html;
}