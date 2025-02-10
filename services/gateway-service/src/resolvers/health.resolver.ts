export const healthResolver = {
  Query: {
    health: () => ({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  }
}
