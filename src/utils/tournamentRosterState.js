/** معرف نافذة «إضافة المشاركين» الموحّدة (ليست لفريق محدد) */
export const TOURNAMENT_ROSTER_MODAL_TEAM_ID = '__tournament_roster__'

export function emptyRosterBench() {
  return { memberIds: [], guests: [], memberFees: {} }
}

export function stripMemberFromTeamsList(teamsList, memberId) {
  const mid = String(memberId)
  return (teamsList || []).map((t) => {
    if (!(t.memberIds || []).some((x) => String(x) === mid)) return t
    const ids = (t.memberIds || []).filter((x) => String(x) !== mid)
    const mp = { ...(t.memberTournamentPayments || {}) }
    delete mp[mid]
    return { ...t, memberIds: ids, memberTournamentPayments: mp }
  })
}

export function removeMemberFromBench(rb, memberId) {
  const mid = String(memberId)
  const base = rb && typeof rb === 'object' ? rb : emptyRosterBench()
  const mf = { ...(base.memberFees || {}) }
  delete mf[mid]
  return {
    ...base,
    memberIds: (base.memberIds || []).filter((id) => String(id) !== mid),
    memberFees: mf,
  }
}

/** إزالة العضو من كل الفرق ومن مقعد الانتظار */
export function stripMemberFromAllTeamsAndBench(stateSlice, memberId) {
  const teams = stripMemberFromTeamsList(stateSlice.teams, memberId)
  const rosterBench = removeMemberFromBench(stateSlice.rosterBench, memberId)
  return { ...stateSlice, teams, rosterBench }
}

export function addMemberToBenchInState(stateSlice, memberId, feeStr) {
  let next = stripMemberFromAllTeamsAndBench(stateSlice, memberId)
  const rb = next.rosterBench || emptyRosterBench()
  const mid = String(memberId)
  const memberIds = (rb.memberIds || []).some((id) => String(id) === mid)
    ? rb.memberIds
    : [...(rb.memberIds || []), memberId]
  return {
    ...next,
    rosterBench: {
      ...rb,
      memberIds,
      memberFees: { ...(rb.memberFees || {}), [mid]: feeStr != null ? String(feeStr) : '' },
    },
  }
}

export function removeGuestByIdFromTeamsAndBench(teamsList, bench, guestId) {
  const gid = String(guestId)
  const teams = (teamsList || []).map((t) => ({
    ...t,
    pendingFeeGuests: (t.pendingFeeGuests || []).filter((g) => String(g.id) !== gid),
  }))
  const rb = bench && typeof bench === 'object' ? bench : emptyRosterBench()
  return {
    teams,
    rosterBench: {
      ...rb,
      guests: (rb.guests || []).filter((g) => String(g.id) !== gid),
    },
  }
}

export function addGuestToBenchInState(stateSlice, guestRow) {
  const { teams, rosterBench } = removeGuestByIdFromTeamsAndBench(
    stateSlice.teams,
    stateSlice.rosterBench,
    guestRow.id
  )
  return {
    ...stateSlice,
    teams,
    rosterBench: {
      ...rosterBench,
      guests: [...(rosterBench.guests || []).filter((g) => String(g.id) !== String(guestRow.id)), guestRow],
    },
  }
}
