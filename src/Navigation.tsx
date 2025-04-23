function shouldNotIntercept(navigationEvent) {
  return (
    !navigationEvent.canIntercept ||
    // If this is just a hashChange,
    // just let the browser handle scrolling to the content.
    navigationEvent.hashChange ||
    // If this is a download,
    // let the browser perform the download.
    navigationEvent.downloadRequest ||
    // If this is a form submission,
    // let that go to the server.
    navigationEvent.formData
  );
}

function renderIndexPage() {} // methods to render HTML for page
function renderCatsPage() {}

navigation.addEventListener("navigate", (navigateEvent) => {
  // Exit early if this navigation shouldn't be intercepted.
  if (shouldNotIntercept(navigateEvent)) return;

  const url = new URL(navigateEvent.destination.url);

  if (url.pathname === "/") {
    navigateEvent.intercept({ handler: renderIndexPage });
  } else if (url.pathname === "/cats/") {
    navigateEvent.intercept({ handler: renderCatsPage });
  }
});
