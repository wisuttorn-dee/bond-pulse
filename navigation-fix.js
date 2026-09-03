// Navigation safety layer for Bond Pulse.
// Uses event delegation so landing buttons keep working after any DOM re-render.

function goTo(hash) {
  if (location.hash === hash) {
    // Force the app's hashchange-driven renderer to run even if already on the route.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = hash
  }
}

document.addEventListener('click', (event) => {
  const hostButton = event.target.closest('#hostBtn')
  if (hostButton) {
    event.preventDefault()
    goTo('#host')
    return
  }

  const studentButton = event.target.closest('#joinBtn')
  if (studentButton) {
    event.preventDefault()
    goTo('#join')
    return
  }

  const homeButton = event.target.closest('[data-bp-home]')
  if (homeButton) {
    event.preventDefault()
    if (location.hash) location.hash = ''
    else window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}, true)
