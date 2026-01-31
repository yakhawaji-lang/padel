import React, { useState, useEffect } from 'react'
import './App.css'
import { translations } from './translations'

function App() {
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [courts, setCourts] = useState([null, null, null, null])
  const [matchTimers, setMatchTimers] = useState({})
  const [language, setLanguage] = useState('en')
  const [tournamentMode, setTournamentMode] = useState('king') // 'king' or 'social'
  const [groupStage, setGroupStage] = useState({}) // For social tournament: {court1: [teams], ...}
  const [qualifiedTeams, setQualifiedTeams] = useState([]) // Teams that qualified from groups
  const [tournamentStage, setTournamentStage] = useState('group') // 'group', 'semi', 'final', 'third'
  const [semiFinals, setSemiFinals] = useState([]) // Semi-final matches
  const [finals, setFinals] = useState([]) // Final matches
  const [showMatchHistory, setShowMatchHistory] = useState(false) // Toggle match history visibility
  const [showMatchSchedule, setShowMatchSchedule] = useState(false) // Toggle match schedule visibility
  
  const t = translations[language]
  const isRTL = language === 'ar'

  // Initialize with 8 default teams (for King of Court)
  useEffect(() => {
    if (teams.length === 0) {
      const defaultTeams = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i + 1}`,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesWon: 0,
        gamesLost: 0,
        matchesPlayed: 0
      }))
      setTeams(defaultTeams)
    }
  }, [])
  
  // Update document direction for RTL
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language, isRTL])

  // Add team
  const addTeam = () => {
    const newTeam = {
      id: teams.length + 1,
      name: language === 'ar' ? `فريق ${teams.length + 1}` : `Team ${teams.length + 1}`,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesWon: 0,
      gamesLost: 0,
      matchesPlayed: 0
    }
    setTeams([...teams, newTeam])
  }
  
  // Toggle language
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en')
  }

  // Remove team
  const removeTeam = (teamId) => {
    if (teams.length <= 2) {
      alert(t.needTwoTeams)
      return
    }
    setTeams(teams.filter(t => t.id !== teamId))
    setCourts(courts.map(c => 
      c && (c.team1.id === teamId || c.team2.id === teamId) ? null : c
    ))
  }

  // Update team name
  const updateTeamName = (teamId, newName) => {
    setTeams(teams.map(t => t.id === teamId ? { ...t, name: newName } : t))
  }

  // Check if two teams have already played
  const havePlayed = (team1Id, team2Id) => {
    return matches.some(m => 
      (m.team1.id === team1Id && m.team2.id === team2Id) ||
      (m.team1.id === team2Id && m.team2.id === team1Id)
    )
  }

  // Generate fair match schedule ensuring each team plays exactly 7 matches (King of Court)
  const generateFairSchedule = () => {
    const availableTeams = teams.filter(t => t.matchesPlayed < 7)
    const scheduledMatches = []
    const usedTeams = new Set()

    // Create all possible matchups that haven't been played
    const possibleMatchups = []
    for (let i = 0; i < availableTeams.length; i++) {
      for (let j = i + 1; j < availableTeams.length; j++) {
        const team1 = availableTeams[i]
        const team2 = availableTeams[j]
        if (!havePlayed(team1.id, team2.id) && 
            team1.matchesPlayed < 7 && 
            team2.matchesPlayed < 7) {
          possibleMatchups.push([team1, team2])
        }
      }
    }

    // Sort by priority: teams with fewer matches first
    possibleMatchups.sort((a, b) => {
      const aTotal = a[0].matchesPlayed + a[1].matchesPlayed
      const bTotal = b[0].matchesPlayed + b[1].matchesPlayed
      return aTotal - bTotal
    })

    // Assign matches to courts (max 4)
    const newCourts = [null, null, null, null]
    let courtIndex = 0

    for (const [team1, team2] of possibleMatchups) {
      if (courtIndex >= 4) break
      if (usedTeams.has(team1.id) || usedTeams.has(team2.id)) continue
      
      newCourts[courtIndex] = {
        team1,
        team2,
        courtNumber: courtIndex + 1,
        startTime: Date.now(),
        winner: null
      }
      usedTeams.add(team1.id)
      usedTeams.add(team2.id)
      courtIndex++
    }

    return newCourts
  }

  // Initialize groups for drag and drop
  const initializeGroups = () => {
    if (teams.length < 12) {
      alert('Social Tournament requires at least 12 teams (3 teams per court × 4 courts)')
      return
    }
    
    const newGroups = {
      court1: [],
      court2: [],
      court3: [],
      court4: []
    }
    setGroupStage(newGroups)
    setTournamentStage('group')
  }
  
  // Start group stage matches after teams are assigned
  const startGroupStage = () => {
    // Check all groups have 3 teams
    const allGroupsFull = Object.keys(groupStage).every(key => groupStage[key].length === 3)
    if (!allGroupsFull) {
      alert('Please assign 3 teams to each group before starting')
      return
    }
    
    const newCourts = [null, null, null, null]
    
    for (let i = 0; i < 4; i++) {
      const groupTeams = groupStage[`court${i + 1}`]
      if (groupTeams.length >= 2) {
        newCourts[i] = {
          team1: groupTeams[0],
          team2: groupTeams[1],
          team3: groupTeams[2],
          courtNumber: i + 1,
          startTime: Date.now(),
          winner: null,
          isGroupStage: true,
          groupId: `court${i + 1}`
        }
      }
    }
    
    setCourts(newCourts)
  }
  
  // Handle drag and drop
  const handleDragStart = (e, team) => {
    e.dataTransfer.setData('teamId', team.id.toString())
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    e.currentTarget.classList.add('drag-over')
  }
  
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over')
  }
  
  const handleDrop = (e, groupId) => {
    e.preventDefault()
    const teamId = parseInt(e.dataTransfer.getData('teamId'))
    const team = teams.find(t => t.id === teamId)
    
    if (!team) return
    
    // Check if team is already in a group
    const currentGroup = Object.keys(groupStage).find(key => 
      groupStage[key].some(t => t.id === teamId)
    )
    
    // Remove from current group if exists
    const updatedGroups = { ...groupStage }
    if (currentGroup) {
      updatedGroups[currentGroup] = updatedGroups[currentGroup].filter(t => t.id !== teamId)
    }
    
    // Add to new group if not full
    if (updatedGroups[groupId].length < 3) {
      updatedGroups[groupId] = [...updatedGroups[groupId], team]
    }
    
    setGroupStage(updatedGroups)
  }
  
  const removeTeamFromGroup = (teamId, groupId) => {
    const updatedGroups = { ...groupStage }
    updatedGroups[groupId] = updatedGroups[groupId].filter(t => t.id !== teamId)
    setGroupStage(updatedGroups)
  }
  
  // Get unassigned teams
  const getUnassignedTeams = () => {
    const assignedTeamIds = new Set()
    Object.values(groupStage).forEach(group => {
      group.forEach(team => assignedTeamIds.add(team.id))
    })
    return teams.filter(t => !assignedTeamIds.has(t.id))
  }
  
  // Generate match schedule showing which teams play each other (for King of Court)
  const generateMatchSchedule = () => {
    if (tournamentMode !== 'king') return []
    
    const schedule = []
    const maxMatches = 7
    
    // Generate all possible matchups
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const team1 = teams[i]
        const team2 = teams[j]
        const hasPlayed = havePlayed(team1.id, team2.id)
        const team1Matches = team1.matchesPlayed
        const team2Matches = team2.matchesPlayed
        
        schedule.push({
          team1,
          team2,
          hasPlayed,
          team1Matches,
          team2Matches,
          canPlay: !hasPlayed && team1Matches < maxMatches && team2Matches < maxMatches
        })
      }
    }
    
    return schedule.sort((a, b) => {
      // Sort by: can play first, then by total matches played
      if (a.canPlay !== b.canPlay) return b.canPlay - a.canPlay
      const aTotal = a.team1Matches + a.team2Matches
      const bTotal = b.team1Matches + b.team2Matches
      return aTotal - bTotal
    })
  }
  
  // Get team's opponents list
  const getTeamOpponents = (teamId) => {
    const opponents = []
    matches.forEach(match => {
      if (match.team1.id === teamId) {
        opponents.push({ team: match.team2, match })
      } else if (match.team2.id === teamId) {
        opponents.push({ team: match.team1, match })
      }
    })
    return opponents
  }

  // Assign teams to courts
  const assignToCourts = () => {
    if (tournamentMode === 'social') {
      if (Object.keys(groupStage).length === 0) {
        initializeGroups()
      } else {
        startGroupStage()
      }
    } else {
      const newCourts = generateFairSchedule()
      setCourts(newCourts)
    }
  }
  
  // Get next match for a group in social tournament
  const getNextGroupMatch = (groupId, allMatches = matches) => {
    const groupTeams = groupStage[groupId] || []
    const groupMatches = allMatches.filter(m => m.groupId === groupId)
    const playedPairs = new Set()
    
    groupMatches.forEach(m => {
      const pair = [m.team1.id, m.team2.id].sort().join('-')
      playedPairs.add(pair)
    })
    
    // Find next unplayed matchup
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        const pair = [groupTeams[i].id, groupTeams[j].id].sort().join('-')
        if (!playedPairs.has(pair)) {
          return [groupTeams[i], groupTeams[j]]
        }
      }
    }
    return null
  }
  
  // Check if group stage is complete and get qualifier
  const checkGroupComplete = (groupId) => {
    const groupTeams = groupStage[groupId] || []
    if (groupTeams.length === 0) return null
    
    const groupMatches = matches.filter(m => m.groupId === groupId)
    
    // Each team should play 2 matches in a group of 3 (round-robin)
    const expectedMatches = 3 // 3 teams = 3 matches (A vs B, A vs C, B vs C)
    if (groupMatches.length < expectedMatches) return null
    
    // Calculate standings for this group using current team data
    const groupStandings = groupTeams.map(teamId => {
      const team = teams.find(t => t.id === teamId.id) || teamId
      const teamMatches = groupMatches.filter(m => 
        m.team1.id === team.id || m.team2.id === team.id
      )
      let wins = 0
      let gamesWon = 0
      let gamesLost = 0
      
      teamMatches.forEach(match => {
        const isTeam1 = match.team1.id === team.id
        const teamGames = isTeam1 ? match.team1Games : match.team2Games
        const opponentGames = isTeam1 ? match.team2Games : match.team1Games
        
        gamesWon += teamGames
        gamesLost += opponentGames
        
        if (match.winner && match.winner.id === team.id) {
          wins++
        }
      })
      
      return {
        ...team,
        wins,
        gamesWon,
        gamesLost,
        gamesDiff: gamesWon - gamesLost
      }
    })
    
    // Sort by wins, then games diff
    groupStandings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.gamesDiff - a.gamesDiff
    })
    
    return groupStandings[0] // Return first place
  }
  
  // Check all groups and move to semi-finals
  const checkAllGroupsComplete = () => {
    const qualifiers = []
    for (let i = 1; i <= 4; i++) {
      const qualifier = checkGroupComplete(`court${i}`)
      if (qualifier) {
        qualifiers.push(qualifier)
      }
    }
    
    if (qualifiers.length === 4) {
      setQualifiedTeams(qualifiers)
      setupSemiFinals(qualifiers)
    }
  }
  
  // Setup semi-finals
  const setupSemiFinals = (qualifiers) => {
    const semi1 = {
      team1: qualifiers[0],
      team2: qualifiers[1],
      courtNumber: 1,
      startTime: Date.now(),
      winner: null,
      isSemiFinal: true,
      semiNumber: 1
    }
    const semi2 = {
      team1: qualifiers[2],
      team2: qualifiers[3],
      courtNumber: 2,
      startTime: Date.now(),
      winner: null,
      isSemiFinal: true,
      semiNumber: 2
    }
    
    setCourts([semi1, semi2, null, null])
    setSemiFinals([semi1, semi2])
    setTournamentStage('semi')
  }
  
  // Check semi-finals complete and setup final/3rd place
  const checkSemiFinalsComplete = () => {
    const semiMatches = matches.filter(m => m.isSemiFinal)
    if (semiMatches.length < 2) return
    
    const semi1Match = semiMatches.find(m => m.semiNumber === 1)
    const semi2Match = semiMatches.find(m => m.semiNumber === 2)
    
    if (!semi1Match?.winner || !semi2Match?.winner) return
    
    const semi1Winner = semi1Match.winner
    const semi2Winner = semi2Match.winner
    const semi1Loser = semi1Match.team1.id === semi1Winner.id ? semi1Match.team2 : semi1Match.team1
    const semi2Loser = semi2Match.team1.id === semi2Winner.id ? semi2Match.team2 : semi2Match.team1
    
    if (semi1Winner && semi2Winner && semi1Loser && semi2Loser) {
      const finalMatch = {
        team1: semi1Winner,
        team2: semi2Winner,
        courtNumber: 1,
        startTime: Date.now(),
        winner: null,
        isFinal: true
      }
      const thirdPlaceMatch = {
        team1: semi1Loser,
        team2: semi2Loser,
        courtNumber: 2,
        startTime: Date.now(),
        winner: null,
        isThirdPlace: true
      }
      
      setCourts([finalMatch, thirdPlaceMatch, null, null])
      setFinals([finalMatch, thirdPlaceMatch])
      setTournamentStage('final')
    }
  }

  // Start match timer (15 minutes)
  const startMatchTimer = (courtNumber) => {
    const timer = matchTimers[courtNumber]
    const initialElapsed = timer?.paused ? timer.elapsed : 0
    const startTime = Date.now()
    
    const timerId = setInterval(() => {
      setMatchTimers(prev => {
        const newTimers = { ...prev }
        const currentTimer = newTimers[courtNumber]
        if (!currentTimer) return newTimers
        
        if (!currentTimer.paused) {
          const elapsed = initialElapsed + Math.floor((Date.now() - startTime) / 1000)
          currentTimer.elapsed = elapsed
          
        if (elapsed >= 900 && !currentTimer.alerted) {
          currentTimer.alerted = true
          alert(`${t.court} ${courtNumber}: ${t.timeUpAlert}`)
        }
        }
        
        return newTimers
      })
    }, 1000)

    setMatchTimers(prev => ({
      ...prev,
      [courtNumber]: { 
        startTime, 
        elapsed: initialElapsed, 
        timerId, 
        alerted: timer?.alerted || false,
        paused: false
      }
    }))
  }

  // Pause timer with confirmation
  const pauseTimer = (courtNumber) => {
    if (window.confirm(t.confirmPause)) {
      const timer = matchTimers[courtNumber]
      if (timer?.timerId) {
        clearInterval(timer.timerId)
      }
      setMatchTimers(prev => ({
        ...prev,
        [courtNumber]: {
          ...prev[courtNumber],
          paused: true,
          timerId: null
        }
      }))
    }
  }

  // Resume timer
  const resumeTimer = (courtNumber) => {
    startMatchTimer(courtNumber)
  }

  // Reset timer
  const resetTimer = (courtNumber) => {
    if (window.confirm(t.confirmReset)) {
      const timer = matchTimers[courtNumber]
      if (timer?.timerId) {
        clearInterval(timer.timerId)
      }
      setMatchTimers(prev => {
        const newTimers = { ...prev }
        delete newTimers[courtNumber]
        return newTimers
      })
    }
  }

  // Record match result - determines winner from scores
  const recordMatchResult = (courtIndex, team1Games, team2Games) => {
    const court = courts[courtIndex]
    if (!court) return

    // Determine winner based on scores (or tie if equal)
    const isTie = team1Games === team2Games
    const winnerId = isTie ? null : (team1Games > team2Games ? court.team1.id : court.team2.id)
    const winner = isTie ? null : (winnerId === court.team1.id ? court.team1 : court.team2)
    const loser = isTie ? null : (winnerId === court.team1.id ? court.team2 : court.team1)

    // Update team stats
    const updatedTeams = teams.map(t => {
      if (isTie) {
        // Both teams get the same result for a tie
        if (t.id === court.team1.id) {
          return {
            ...t,
            draws: t.draws + 1,
            gamesWon: t.gamesWon + team1Games,
            gamesLost: t.gamesLost + team2Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else if (t.id === court.team2.id) {
          return {
            ...t,
            draws: t.draws + 1,
            gamesWon: t.gamesWon + team2Games,
            gamesLost: t.gamesLost + team1Games,
            matchesPlayed: t.matchesPlayed + 1
          }
        }
      } else {
        // Normal win/loss
        if (t.id === winner.id) {
          const winnerGames = winnerId === court.team1.id ? team1Games : team2Games
          const loserGames = winnerId === court.team1.id ? team2Games : team1Games
          return {
            ...t,
            wins: t.wins + 1,
            gamesWon: t.gamesWon + winnerGames,
            gamesLost: t.gamesLost + loserGames,
            matchesPlayed: t.matchesPlayed + 1
          }
        } else if (t.id === loser.id) {
          const winnerGames = winnerId === court.team1.id ? team1Games : team2Games
          const loserGames = winnerId === court.team1.id ? team2Games : team1Games
          return {
            ...t,
            losses: t.losses + 1,
            gamesWon: t.gamesWon + loserGames,
            gamesLost: t.gamesLost + winnerGames,
            matchesPlayed: t.matchesPlayed + 1
          }
        }
      }
      return t
    })

    setTeams(updatedTeams)

    // Record match
    const newMatch = {
      id: matches.length + 1,
      team1: court.team1,
      team2: court.team2,
      winner: winner,
      isTie: isTie,
      team1Games,
      team2Games,
      courtNumber: court.courtNumber,
      timestamp: Date.now(),
      groupId: court.groupId,
      isSemiFinal: court.isSemiFinal,
      semiNumber: court.semiNumber,
      isFinal: court.isFinal,
      isThirdPlace: court.isThirdPlace
    }
    const updatedMatches = [...matches, newMatch]
    setMatches(updatedMatches)

    // Handle social tournament logic
    if (tournamentMode === 'social') {
      if (court.isGroupStage) {
        // Check if group has more matches using updated matches array
        const nextMatch = getNextGroupMatch(court.groupId, updatedMatches)
        const updatedCourts = [...courts]
        
        if (nextMatch) {
          // Set up next match in the group
          updatedCourts[courtIndex] = {
            ...court,
            team1: nextMatch[0],
            team2: nextMatch[1],
            winner: null
          }
          setCourts(updatedCourts)
        } else {
          // Group stage complete for this court
          updatedCourts[courtIndex] = null
          setCourts(updatedCourts)
          // Use setTimeout to ensure state is updated before checking
          setTimeout(() => {
            checkAllGroupsComplete()
          }, 0)
        }
      } else if (court.isSemiFinal) {
        // Semi-final completed
        const updatedCourts = [...courts]
        updatedCourts[courtIndex] = null
        setCourts(updatedCourts)
        checkSemiFinalsComplete()
      } else {
        // Final or 3rd place match completed
        const updatedCourts = [...courts]
        updatedCourts[courtIndex] = null
        setCourts(updatedCourts)
      }
    } else {
      // King of the court - clear court
      const updatedCourts = [...courts]
      updatedCourts[courtIndex] = null
      setCourts(updatedCourts)
    }

    // Stop timer
    if (matchTimers[court.courtNumber]?.timerId) {
      clearInterval(matchTimers[court.courtNumber].timerId)
    }
    setMatchTimers(prev => {
      const newTimers = { ...prev }
      delete newTimers[court.courtNumber]
      return newTimers
    })
  }

  // Calculate standings
  const getStandings = () => {
    return [...teams].sort((a, b) => {
      // First by wins
      if (b.wins !== a.wins) {
        return b.wins - a.wins
      }
      // Then by games won
      return b.gamesWon - a.gamesWon
    })
  }
  
  // Calculate standings for a specific group
  const getGroupStandings = (groupId) => {
    const groupTeams = groupStage[groupId] || []
    if (groupTeams.length === 0) return []
    
    const groupMatches = matches.filter(m => m.groupId === groupId)
    
    const groupStandings = groupTeams.map(team => {
      const teamMatches = groupMatches.filter(m => 
        m.team1.id === team.id || m.team2.id === team.id
      )
      let wins = 0
      let losses = 0
      let draws = 0
      let gamesWon = 0
      let gamesLost = 0
      
      teamMatches.forEach(match => {
        const isTeam1 = match.team1.id === team.id
        const teamGames = isTeam1 ? match.team1Games : match.team2Games
        const opponentGames = isTeam1 ? match.team2Games : match.team1Games
        
        gamesWon += teamGames
        gamesLost += opponentGames
        
        if (match.isTie) {
          draws++
        } else if (match.winner && match.winner.id === team.id) {
          wins++
        } else if (match.winner) {
          losses++
        }
      })
      
      return {
        ...team,
        wins,
        losses,
        draws,
        gamesWon,
        gamesLost,
        gamesDiff: gamesWon - gamesLost,
        matchesPlayed: teamMatches.length
      }
    })
    
    // Sort by wins, then games diff
    return groupStandings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.gamesDiff - a.gamesDiff
    })
  }

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get remaining time
  const getRemainingTime = (courtNumber) => {
    const timer = matchTimers[courtNumber]
    if (!timer) return '15:00'
    const remaining = 900 - timer.elapsed
    if (remaining <= 0) return t.timeUp
    return formatTime(remaining)
  }

  const standings = getStandings()

  const toggleTournamentMode = () => {
    const newMode = tournamentMode === 'king' ? 'social' : 'king'
    setTournamentMode(newMode)
    // Reset tournament state when switching
    setCourts([null, null, null, null])
    setGroupStage({})
    setQualifiedTeams([])
    setTournamentStage('group')
    setSemiFinals([])
    setFinals([])
    setMatches([])
    setMatchTimers({})
    // Reset team stats
    setTeams(teams.map(t => ({
      ...t,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesWon: 0,
      gamesLost: 0,
      matchesPlayed: 0
    })))
  }

  return (
    <div className={`app ${isRTL ? 'rtl' : ''}`}>
      <div className="top-controls">
        <div className="language-toggle">
          <button 
            className="btn-secondary btn-small"
            onClick={toggleLanguage}
          >
            {language === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
        <div className="tournament-mode-toggle">
          <button 
            className={`btn-secondary ${tournamentMode === 'king' ? 'active' : ''}`}
            onClick={toggleTournamentMode}
          >
            {t.kingOfCourt}
          </button>
          <button 
            className={`btn-secondary ${tournamentMode === 'social' ? 'active' : ''}`}
            onClick={toggleTournamentMode}
          >
            {t.socialTournament}
          </button>
        </div>
      </div>
      <h1>{t.title}</h1>
      <div className="tournament-name">
        <h2>{tournamentMode === 'king' ? t.kingOfCourt : t.socialTournament}</h2>
      </div>
      {tournamentMode === 'social' && (
        <div className="tournament-stage">
          <h3>
            {tournamentStage === 'group' && t.groupStage}
            {tournamentStage === 'semi' && t.semiFinal}
            {tournamentStage === 'final' && t.final}
          </h3>
        </div>
      )}

      {/* Standings Table */}
      <div className="section">
        <h2>{t.standings}</h2>
        {tournamentMode === 'social' && tournamentStage === 'group' && Object.keys(groupStage).length > 0 ? (
          <div className="group-standings-container">
            {Object.keys(groupStage).map((groupId, idx) => {
              const groupStandings = getGroupStandings(groupId)
              return (
                <div key={groupId} className="group-standings">
                  <h3>{t.group} {idx + 1} - {t.standings}</h3>
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th>{t.rank}</th>
                        <th>{t.team}</th>
                        <th>{t.wins}</th>
                        <th>{t.losses}</th>
                        <th>{t.draws}</th>
                        <th>{t.gamesWon}</th>
                        <th>{t.gamesLost}</th>
                        <th>{t.gamesDiff}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStandings.map((team, index) => {
                        const gamesDiff = team.gamesWon - team.gamesLost
                        return (
                          <tr key={team.id} className={index === 0 ? 'top-4' : ''}>
                            <td>{index + 1}</td>
                            <td><strong>{team.name}</strong></td>
                            <td>{team.wins}</td>
                            <td>{team.losses}</td>
                            <td>{team.draws || 0}</td>
                            <td>{team.gamesWon}</td>
                            <td>{team.gamesLost}</td>
                            <td className={gamesDiff > 0 ? 'positive' : gamesDiff < 0 ? 'negative' : ''}>
                              {gamesDiff > 0 ? '+' : ''}{gamesDiff}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        ) : (
          <table className="standings-table">
            <thead>
              <tr>
                <th>{t.rank}</th>
                <th>{t.team}</th>
                <th>{t.wins}</th>
                <th>{t.losses}</th>
                <th>{t.draws}</th>
                <th>{t.gamesWon}</th>
                <th>{t.gamesLost}</th>
                <th>{t.gamesDiff}</th>
                {tournamentMode === 'king' && <th>{t.matches}</th>}
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => {
                const gamesDiff = team.gamesWon - team.gamesLost
                return (
                  <tr key={team.id} className={index < 4 ? 'top-4' : ''}>
                    <td>{index + 1}</td>
                    <td><strong>{team.name}</strong></td>
                    <td>{team.wins}</td>
                    <td>{team.losses}</td>
                    <td>{team.draws || 0}</td>
                    <td>{team.gamesWon}</td>
                    <td>{team.gamesLost}</td>
                    <td className={gamesDiff > 0 ? 'positive' : gamesDiff < 0 ? 'negative' : ''}>
                      {gamesDiff > 0 ? '+' : ''}{gamesDiff}
                    </td>
                    {tournamentMode === 'king' && <td>{team.matchesPlayed}/7</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Team Management */}
      <div className="section">
        <div className="section-header">
          <h2>{t.teams} ({teams.length})</h2>
          <button className="btn-primary" onClick={addTeam}>{t.add}</button>
        </div>
        {tournamentMode === 'social' && tournamentStage === 'group' && Object.keys(groupStage).length > 0 ? (
          <div className="drag-drop-container">
            <div className="unassigned-teams">
              <h3>Unassigned Teams</h3>
              <div className="teams-list">
                {getUnassignedTeams().map(team => (
                  <div 
                    key={team.id} 
                    className="team-item draggable"
                    draggable
                    onDragStart={(e) => handleDragStart(e, team)}
                  >
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => updateTeamName(team.id, e.target.value)}
                      className="team-name-input"
                    />
                    <button 
                      className="btn-danger btn-small"
                      onClick={() => removeTeam(team.id)}
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="groups-container">
              {Object.keys(groupStage).map((groupId, idx) => (
                <div key={groupId} className="group-slot">
                  <h3>{t.group} {idx + 1}</h3>
                  <div 
                    className="group-teams-dropzone"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      handleDrop(e, groupId)
                      e.currentTarget.classList.remove('drag-over')
                    }}
                  >
                    {groupStage[groupId].map(team => (
                      <div key={team.id} className="team-item assigned">
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => updateTeamName(team.id, e.target.value)}
                          className="team-name-input"
                          readOnly
                        />
                        <button 
                          className="btn-danger btn-small"
                          onClick={() => removeTeamFromGroup(team.id, groupId)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {groupStage[groupId].length < 3 && (
                      <div className="drop-hint">
                        {t.group} {idx + 1} ({groupStage[groupId].length}/3)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="teams-list">
            {teams.map(team => (
              <div key={team.id} className="team-item">
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => updateTeamName(team.id, e.target.value)}
                  className="team-name-input"
                />
                <button 
                  className="btn-danger btn-small"
                  onClick={() => removeTeam(team.id)}
                >
                  −
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Courts */}
      <div className="section">
        <div className="section-header">
          <h2>
            {tournamentMode === 'social' && tournamentStage === 'group' && t.groupStage}
            {tournamentMode === 'social' && tournamentStage === 'semi' && t.semiFinal}
            {tournamentMode === 'social' && tournamentStage === 'final' && (t.final + ' / ' + t.thirdPlace)}
            {tournamentMode === 'king' && t.courts}
          </h2>
          <button className="btn-secondary" onClick={assignToCourts}>
            {tournamentMode === 'social' && Object.keys(groupStage).length === 0 
              ? 'Initialize Groups' 
              : tournamentMode === 'social' && Object.keys(groupStage).length > 0 && courts.every(c => !c)
              ? 'Start Group Stage'
              : t.assignMatches}
          </button>
        </div>
        {tournamentMode === 'social' && tournamentStage === 'group' && Object.keys(groupStage).length > 0 && (
          <div className="groups-info">
            {Object.keys(groupStage).map((groupId, idx) => {
              const qualifier = checkGroupComplete(groupId)
              return (
                <div key={groupId} className="group-info">
                  <strong>{t.group} {idx + 1}:</strong> {groupStage[groupId].map(t => t.name).join(', ')}
                  {qualifier && <span className="qualified"> - {t.qualified}: {qualifier.name}</span>}
                </div>
              )
            })}
          </div>
        )}
        <div className="courts-grid">
          {courts.map((court, index) => (
            <div key={index} className="court-card">
              <h3>
                {court?.isSemiFinal && t.semiFinal} {court?.isFinal && t.final} {court?.isThirdPlace && t.thirdPlace}
                {!court?.isSemiFinal && !court?.isFinal && !court?.isThirdPlace && `${t.court} ${index + 1}`}
                {court?.isGroupStage && ` - ${t.group} ${index + 1}`}
              </h3>
              {court ? (
                <>
                  <div className="match-teams">
                    <div>{court.team1.name}</div>
                    <div className="vs">{t.vs}</div>
                    <div>{court.team2.name}</div>
                    {court.team3 && <div className="group-team">({court.team3.name})</div>}
                  </div>
                  {matchTimers[court.courtNumber] ? (
                    <>
                      <div className={`match-timer ${getRemainingTime(court.courtNumber) === t.timeUp || (matchTimers[court.courtNumber] && (900 - matchTimers[court.courtNumber].elapsed) < 60) ? 'time-warning' : ''} ${matchTimers[court.courtNumber].paused ? 'paused' : ''}`}>
                        {getRemainingTime(court.courtNumber)}
                        {matchTimers[court.courtNumber].paused && <span className="paused-label"> {t.paused}</span>}
                      </div>
                      <div className="timer-controls">
                        {matchTimers[court.courtNumber].paused ? (
                          <button
                            className="btn-secondary"
                            style={{ width: '100%', marginBottom: '8px' }}
                            onClick={() => resumeTimer(court.courtNumber)}
                          >
                            {t.resume}
                          </button>
                        ) : (
                          <button
                            className="btn-secondary"
                            style={{ width: '100%', marginBottom: '8px' }}
                            onClick={() => pauseTimer(court.courtNumber)}
                          >
                            {t.pause}
                          </button>
                        )}
                        <button
                          className="btn-danger"
                          style={{ width: '100%', marginBottom: '15px' }}
                          onClick={() => resetTimer(court.courtNumber)}
                        >
                          {t.reset}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="btn-secondary"
                      style={{ width: '100%', marginBottom: '15px' }}
                      onClick={() => startMatchTimer(court.courtNumber)}
                    >
                      {t.startTimer}
                    </button>
                  )}
                  <div className="score-inputs" key={`${court.team1.id}-${court.team2.id}-${court.courtNumber}`}>
                    <div>
                      <label>{court.team1.name}</label>
                      <input
                        type="number"
                        min="0"
                        max="6"
                        id={`team1-games-${index}`}
                        key={`team1-${court.team1.id}-${court.team2.id}`}
                        defaultValue="0"
                      />
                    </div>
                    <div>
                      <label>{court.team2.name}</label>
                      <input
                        type="number"
                        min="0"
                        max="6"
                        id={`team2-games-${index}`}
                        key={`team2-${court.team1.id}-${court.team2.id}`}
                        defaultValue="0"
                      />
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', marginTop: '10px' }}
                    onClick={() => {
                      const team1Games = parseInt(document.getElementById(`team1-games-${index}`).value) || 0
                      const team2Games = parseInt(document.getElementById(`team2-games-${index}`).value) || 0
                      recordMatchResult(index, team1Games, team2Games)
                    }}
                  >
                    {t.recordResult}
                  </button>
                </>
              ) : (
                <p className="empty-court">{t.empty}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Match Schedule - Collapsible (King of Court only) */}
      {tournamentMode === 'king' && (
        <div className="section">
          <div className="section-header">
            <h2>{t.matchSchedule} / {t.verifyPairings}</h2>
            <button 
              className="btn-secondary"
              onClick={() => setShowMatchSchedule(!showMatchSchedule)}
            >
              {showMatchSchedule ? t.hideSchedule : t.showSchedule}
            </button>
          </div>
          {showMatchSchedule && (
            <div className="match-schedule-container">
              <div className="team-opponents-grid">
                {teams.map(team => {
                  const opponents = getTeamOpponents(team.id)
                  const remainingOpponents = teams.filter(t => 
                    t.id !== team.id && 
                    !opponents.some(o => o.team.id === t.id) &&
                    team.matchesPlayed < 7
                  )
                  
                  return (
                    <div key={team.id} className="team-opponents-card">
                      <h4>{team.name}</h4>
                      <div className="opponents-list">
                        <div className="played-opponents">
                          <strong>Played ({opponents.length}):</strong>
                          {opponents.length > 0 ? (
                            <div className="opponent-tags">
                              {opponents.map((opp, idx) => (
                                <span key={idx} className="opponent-tag played">
                                  {opp.team.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="no-opponents">None yet</span>
                          )}
                        </div>
                        {remainingOpponents.length > 0 && (
                          <div className="remaining-opponents">
                            <strong>Remaining ({remainingOpponents.length}):</strong>
                            <div className="opponent-tags">
                              {remainingOpponents.map(opp => (
                                <span key={opp.id} className="opponent-tag remaining">
                                  {opp.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match History - Collapsible */}
      {matches.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2>{t.matchHistory} ({matches.length})</h2>
            <button 
              className="btn-secondary"
              onClick={() => setShowMatchHistory(!showMatchHistory)}
            >
              {showMatchHistory ? t.hideHistory : t.showHistory}
            </button>
          </div>
          {showMatchHistory && (
            <div className="match-history-container">
              <table className="match-history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t.team}</th>
                    <th>{t.vs}</th>
                    <th>{t.team}</th>
                    <th>{t.score}</th>
                    <th>{t.winner}</th>
                    {tournamentMode === 'social' && <th>{t.group}</th>}
                    <th>{t.court}</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.slice().reverse().map((match, index) => (
                    <tr key={match.id}>
                      <td>{matches.length - index}</td>
                      <td><strong>{match.team1.name}</strong></td>
                      <td>{t.vs}</td>
                      <td><strong>{match.team2.name}</strong></td>
                      <td className="score-cell">
                        {match.team1Games} - {match.team2Games}
                      </td>
                      <td>
                        {match.isTie ? (
                          <span className="draw-result">{t.draw}</span>
                        ) : (
                          <span className="winner-result">🏆 {match.winner.name}</span>
                        )}
                      </td>
                      {tournamentMode === 'social' && (
                        <td>
                          {match.groupId ? match.groupId.replace('court', t.group + ' ') : '-'}
                        </td>
                      )}
                      <td>{t.court} {match.courtNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App


