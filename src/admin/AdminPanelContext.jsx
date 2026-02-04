import React, { createContext, useContext } from 'react'

const AdminPanelContext = createContext(null)

export function AdminPanelProvider({ value, children }) {
  return (
    <AdminPanelContext.Provider value={value}>
      {children}
    </AdminPanelContext.Provider>
  )
}

const DEFAULT_CTX = {
  clubs: [],
  language: 'en',
  onUpdateClub: () => {},
  onApproveClub: () => {},
  onRejectClub: () => {},
  onRefresh: () => {},
  onCreateClub: async () => ({}),
  onDeleteClub: async () => {},
}

export function useAdminPanel() {
  const ctx = useContext(AdminPanelContext)
  return ctx || DEFAULT_CTX
}
