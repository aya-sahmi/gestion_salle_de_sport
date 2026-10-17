const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload)

contextBridge.exposeInMainWorld('gym', {
  athletes: {
    list: (filters) => invoke('athletes.list', filters),
    get: (id) => invoke('athletes.get', id),
    create: (input) => invoke('athletes.create', input),
    update: (input) => invoke('athletes.update', input),
  },
  sports: {
    list: () => invoke('sports.list'),
    updateFee: (input) => invoke('sports.updateFee', input),
    updateFees: (inputs) => invoke('sports.updateFees', inputs),
  },
  registrations: {
    list: (filters) => invoke('registrations.list', filters),
    create: (input) => invoke('registrations.create', input),
    end: (input) => invoke('registrations.end', input),
  },
  payments: {
    monthStatus: (input) => invoke('payments.monthStatus', input),
    create: (input) => invoke('payments.create', input),
    list: (filters) => invoke('payments.list', filters),
    get: (id) => invoke('payments.get', id),
    cancel: (input) => invoke('payments.cancel', input),
  },
  dashboard: {
    summary: (input) => invoke('dashboard.summary', input),
  },
  reports: {
    revenue: (filters) => invoke('reports.revenue', filters),
    byPaidMonth: (filters) => invoke('reports.byPaidMonth', filters),
    overdue: () => invoke('reports.overdue'),
  },
  settings: {
    get: () => invoke('settings.get'),
    update: (input) => invoke('settings.update', input),
  },
  receipts: {
    print: () => invoke('receipts.print'),
  },
  backups: {
    create: () => invoke('backups.create'),
    restore: () => invoke('backups.restore'),
  },
})
