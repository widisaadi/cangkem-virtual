// Installation opens setup explicitly. Existing users can review their saved key
// without resetting their persisted onboarding completion or preferences.
function createSetupFlow(store) {
  let fromInstaller = false;
  let transientStep = null;
  return {
    step: () => transientStep ?? store.onboarding(),
    fromInstaller: () => fromInstaller,
    start() {
      fromInstaller = true;
      if (store.onboarding() === 'complete') transientStep = 'connect';
      else if (store.onboarding() === 'welcome') store.setOnboarding('connect');
    },
    move(step) {
      store.validateOnboarding(step);
      if (transientStep !== null) transientStep = step === 'complete' ? null : step;
      else store.setOnboarding(step);
      if (step === 'complete') fromInstaller = false;
    },
  };
}
module.exports = { createSetupFlow };
