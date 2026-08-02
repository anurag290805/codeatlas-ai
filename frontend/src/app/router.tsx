// src/app/router.tsx
import { createBrowserRouter } from "react-router-dom";

/**
 * Temporary root page rendered at "/". Will be replaced by the
 * application shell and dashboard in a later milestone.
 */
function HomePage() {
  return <div>CodeAtlas AI</div>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
]);