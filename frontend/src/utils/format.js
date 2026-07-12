// Formatteur monétaire partagé — arrondi entier, séparateurs fr-FR.
export const formatCfa = (value) =>
  `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} CFA`;
