/** Conteneur de transition de vue — fade + slide-up léger. */
export default function PageTransition({ children }) {
  return <div className="page-enter">{children}</div>
}
