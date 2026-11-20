# Design tokens — frontend

Catalogue des valeurs de design **réellement utilisées** par l'application (aucune théorie : chaque ligne
provient du code source ou du CSS compilé `dist/assets/index-*.css` produit par `npm run build`).

- Thèmes : `clair` (`:root`) et `sombre` (`html[data-theme='sombre']`), commutés par `src/config/theme.js`.
- Tailwind CSS v4.3 — échelle `--spacing: .25rem` (4 px), rayons/polices issus du thème par défaut
  (`node_modules/tailwindcss`), **sans surcharge locale** : ils sont donc définis côté Tailwind et
  consommés via les utilitaires des composants `src/`.

---

## 1. Variables CSS des thèmes (couleurs)

Défini dans : **`src/index.css`** — `:root` (lignes 3‑28) pour le clair, `html[data-theme='sombre']`
(lignes 30‑50) pour le sombre.

| Jeton | Rôle | Clair | Sombre | Fichier |
| --- | --- | --- | --- | --- |
| `--bg` | Fond général de l'application | `#f8fafc` | `#1b2636` | `src/index.css:4` / `:31` |
| `--surface` | Fond des cartes, en‑têtes, menu, tables | `#ffffff` | `#243145` | `src/index.css:5` / `:32` |
| `--surface-alt` | Fond secondaire (survols, en‑tête de table, panneaux) | `#f1f5f9` | `#2d3d52` | `src/index.css:6` / `:33` |
| `--text` | Texte principal | `#0f172a` | `#e8eef6` | `src/index.css:7` / `:34` |
| `--muted` | Texte secondaire / inactif | `#475569` | `#c1cfdf` | `src/index.css:8` / `:35` |
| `--border` | Bordures, séparateurs | `#dfe7f1` | `#465a75` | `src/index.css:9` / `:36` |
| `--primary` | Primaire (boutons, liens, focus, icône active) | `#2563eb` | `#7aa2ff` | `src/index.css:10` / `:37` |
| `--primary-contrast` | Texte **sur** fond primaire | `#ffffff` | `#0f172a` | `src/index.css:12` / `:39` |
| `--primary-ink` | Accent texte (prix, liens) lisible sur surfaces teintées | `#1d4ed8` | `#93c5fd` | `src/index.css:15` / `:41` |
| `--primary-soft` | Accent fond (fond de cellule/ligne active) | `rgba(37,99,235,.12)` ≈ `#2563eb1f` | `rgba(122,162,255,.18)` ≈ `#7aa2ff2e` | `src/index.css:16` / `:42` |
| `--success` | État succès | `#16a34a` | `#22c55e` | `src/index.css:17` / `:43` |
| `--warning` | État avertissement | `#d97706` | `#fbbf24` | `src/index.css:18` / `:44` |
| `--danger` | État erreur / danger | `#dc2626` | `#f87171` | `src/index.css:19` / `:45` |
| `--danger-contrast` | Texte **sur** fond danger | `#ffffff` | `#450a0a` | `src/index.css:21` / `:47` |
| `--shadow` | Variable d'ombre (définie, **non référencée** par `var()`) | `rgba(15,23,42,.08)` ≈ `#0f172a14` | `rgba(2,6,23,.35)` ≈ `#02061759` | `src/index.css:22` / `:48` |

Variables runtime (hors thème), dérivées de la couleur de la boutique `#2563eb` :

| Jeton | Valeur | Défini dans |
| --- | --- | --- |
| `--color-primary` | `#2563eb` (couleur boutique par défaut) | `src/config/boutique.js:6`, appliqué `:36` |
| `--color-primary-soft` | `rgba(37,99,235,.12)` | `src/config/boutique.js:37` |
| `--color-primary-strong` | `rgba(37,99,235,.9)` | `src/config/boutique.js:38` |

### 1.1 Recalibrage des utilitaires Tailwind en thème sombre

Défini dans **`src/index.css:52‑170`** (forçages `!important` pour conserver le contraste AA) :

| Utilitaire | Valeur forcée (sombre) |
| --- | --- |
| `.text-slate-300 … -950` | `var(--text)` = `#e8eef6` |
| `.text-slate-400/500/600` | `var(--muted)` = `#c1cfdf` |
| `.bg-white`, `.bg-slate-50/100` | `var(--surface)` = `#243145` |
| `.bg-slate-200/300` | `var(--surface-alt)` = `#2d3d52` |
| `.border-slate-200 … -500` | `var(--border)` = `#465a75` |
| `.hover:border-slate-400` | `#94a3b8` (`src/index.css:89`) |
| `.shadow`, `.shadow-sm` | `0 1px 2px #0f172a38` (`rgba(15,23,42,.22)`) — `src/index.css:94` |
| `.hover:bg-slate-50/100` | `var(--surface-alt)` = `#2d3d52` |
| `.hover:bg-emerald-50` | `rgba(16,185,129,.18)` ≈ `#10b9812e` (`:105`) |
| `.hover:bg-red-50` | `rgba(239,68,68,.18)` ≈ `#ef44442e` (`:109`) |
| `.bg-amber-50/100` | `rgba(217,119,6,.14)` ≈ `#d9770624` (`:118`) |
| `.bg-orange-100` | `rgba(249,115,22,.14)` ≈ `#f9731624` (`:121`) |
| `.bg-red-50/100` | `rgba(220,38,38,.12)` ≈ `#dc26261f` (`:125`) |
| `.border-amber-200/400` | `rgba(251,191,36,.45)` ≈ `#fbbf2473` (`:129`) |
| `.border-orange-200` | `rgba(251,146,60,.45)` ≈ `#fb923c73` (`:132`) |
| `.border-red-200` | `rgba(252,165,165,.45)` ≈ `#fca5a573` (`:135`) |
| `.text-amber-600…900`, `.text-orange-600/700` | `var(--warning)` = `#fbbf24` (`:141`, `:145`) |
| `.text-red-600…900` | `#fca5a5` (`:151`) |
| `.text-emerald-600/700` | `var(--success)` = `#22c55e` (`:155`) |
| `.text-violet-600/700` | `#a78bfa` (`:159`) |
| `.text-blue-600…900` | `var(--primary-ink)` = `#93c5fd` (`:165`) |
| `.bg-blue-50/100` | `var(--primary-soft)` ≈ `#7aa2ff2e` (`:169`) |

---

## 2. Rayons

Thème Tailwind v4 (`--radius-*`), aucune surcharge dans `src/`.

| Classe | Valeur | Utilisation principale | Où c'est défini / utilisé |
| --- | --- | --- | --- |
| `.rounded` | **4 px** (`0.25rem`) | bouton fermer d'un toast | thème Tailwind — `src/components/Toast.jsx:59` |
| `.rounded-lg` | **8 px** (`0.5rem`) | boutons, champs, items de menu, listes | thème Tailwind — 45 usages (`src/components/Button.jsx:20`, `Layout.jsx:108`, `ProduitForm.jsx:27`…) |
| `.rounded-xl` | **12 px** (`0.75rem`) | encarts internes, listes compactes, recherche Caisse, drawer | thème Tailwind — `src/pages/Caisse.jsx:300,310`, `src/pages/Accueil.jsx:317` |
| `.rounded-2xl` | **16 px** (`1rem`) | cartes, tableaux, modale | thème Tailwind — `src/pages/Accueil.jsx:21`, `src/pages/Produits.jsx:287` |
| `.rounded-t-2xl` | **16 px** (haut uniquement) | modale en bas d'écran (mobile) | thème Tailwind — `src/components/Modal.jsx:35` |
| `.rounded-full` | **9999 px** (impl. `2147483647px`) | badges, pilules de filtre, sélecteur de thème | thème Tailwind — `src/components/Badge.jsx:18`, `Layout.jsx:77` |

---

## 3. Ombres

| Ombre | Valeur exacte | Usage | Défini dans |
| --- | --- | --- | --- |
| `shadow-sm` (clair) | `0 1px 3px 0 #0000001a, 0 1px 2px -1px #0000001a` | cartes, tableaux, champs de recherche | thème Tailwind — `src/pages/Rapport.jsx:31`, `src/pages/Produits.jsx:225` |
| `shadow-sm` (sombre) | `0 1px 2px #0f172a38` (`rgba(15,23,42,.22)`) | idem, forcé | `src/index.css:92‑95` |
| `shadow-lg` | `0 10px 15px -3px #0000001a, 0 4px 6px -4px #0000001a` | toast, info‑bulle KPI | thème Tailwind — `src/components/Toast.jsx:43`, `src/pages/Accueil.jsx:79` |
| `shadow-xl` | `0 20px 25px -5px #0000001a, 0 8px 10px -6px #0000001a` | drawer, survol de bouton | thème Tailwind — `src/components/Drawer.jsx:34`, `Button.jsx:20` |
| `shadow-none` | `0 0 #0000` | variante `ghost` du bouton | thème Tailwind — `src/components/Button.jsx:9` |
| Bouton primaire | `0 10px 20px rgba(37,99,235,.22)` ≈ `0 10px 20px #2563eb38` | élévation du bouton principal | `src/components/Button.jsx:5` |
| Bouton danger | `0 10px 22px rgba(220,38,38,.25)` ≈ `0 10px 22px #dc262640` | élévation du bouton de suppression | `src/components/Button.jsx:8` |
| Modale | `0 24px 60px rgba(15,23,42,.28)` ≈ `0 24px 60px #0f172a47` | panneau de la modale | `src/components/Modal.jsx:35` |
| Survol interactif (clair) | `0 18px 32px rgba(15,23,42,.16)` ≈ `0 18px 32px #0f172a29` | boutons / `.clickable` / `.card-interactive` | `src/index.css:228` |
| Survol interactif (sombre) | `0 18px 36px rgba(2,6,23,.58)` ≈ `0 18px 36px #02061794` | idem | `src/index.css:245` |

---

## 4. Typographie

### 4.1 Famille de police

| Contexte | Valeur | Défini dans |
| --- | --- | --- |
| Application (élément `body`) | `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` | `src/index.css:190‑192` |
| Chiffres tabulaires | `font-variant-numeric: tabular-nums` (utilitaire `.tabular-nums`) | thème Tailwind — `src/components/MessageBar.jsx:133` |
| Ticket thermique | `'Courier New', Courier, monospace` | `src/components/Ticket.css:8` |

### 4.2 Tailles de police (utilisées)

Taille / interligne en px (thème Tailwind `--text-*`, aucun override local).

| Classe | Taille | Interligne | Graisses associées | Où c'est défini / utilisé |
| --- | --- | --- | --- | --- |
| `.text-[11px]` | **11 px** | — | `font-medium`, `font-semibold` | valeur littérale — `src/components/Layout.jsx:161`, `MessageBar.jsx:121` |
| `.text-xs` | **12 px** | **16 px** | `font-semibold`, `font-medium` | thème Tailwind — `src/components/Badge.jsx:18`, en‑têtes de table `Produits.jsx:290` |
| `.text-sm` | **14 px** | **20 px** | `font-medium` / `font-semibold` / `font-bold` | thème Tailwind — taille dominante (106 usages : `Button.jsx:20`, `Layout.jsx:108`) |
| `.text-base` | **16 px** | **24 px** | `font-semibold` | thème Tailwind — titres de modale `src/components/Modal.jsx:40`, `Drawer.jsx:37` |
| `.text-lg` | **18 px** | **28 px** | `font-semibold` | thème Tailwind — `src/pages/Caisse.jsx:608`, `src/pages/Ventes.jsx:512` |
| `.text-xl` | **20 px** | **28 px** | `font-semibold` | thème Tailwind — `src/pages/Accueil.jsx:344‑352` |
| `.text-2xl` | **24 px** | **32 px** | `font-bold` | thème Tailwind — chiffres KPI : `src/pages/Accueil.jsx:28`, `Rapport.jsx:36`, `Caisse.jsx:263` |

Graisses réellement employées : `font-normal` **400** (1), `font-medium` **500** (77),
`font-semibold` **600** (43), `font-bold` **700** (24) — définies par `--font-weight-*` (thème Tailwind),
utilisées dans tous les composants `src/components/*.jsx`.

Autres : `.leading-tight` = **1.25** (`Layout.jsx:54`) ; `.tracking-wide` = **0.025em** (en‑têtes de table,
`Produits.jsx:290`) ; icônes lucide `size` = **16 / 17 / 18 / 20 px** (`Layout.jsx:118,169`,
`MessageBar.jsx:115`).

### 4.3 Ticket d'impression (80 mm) — `src/components/Ticket.css`

| Classe | Taille / valeur |
| --- | --- |
| `.ticket-print` | `10.5 px`, interligne `1.35`, marge `4 mm`, bordure `1 px #d1d5db` |
| `.ticket-brand-name` | `13 px`, `700`, `letter-spacing .08em` |
| `.ticket-total-row` | `12 px`, `700` |
| `.ticket-logo-box` | `11 px`, `700` |
| `.ticket-ligne-meta`, `.ticket-summary-row` | `10 px` |
| `.ticket-brand-meta`, `.ticket-footer` | `9 px` |
| `.ticket-print` impression | fond `#ffffff`, texte `#000000` |

---

## 5. Espacements courants

Base : `--spacing: .25rem` = **4 px** (thème Tailwind, `src/index.css` ne la surcharge pas).
Fréquence mesurée dans `src/**/*.jsx`.

| Classe | Px | Exemple d'usage (fréquence) |
| --- | --- | --- |
| `py-0.5` | **2 px** | padding vertical des badges (4) |
| `p-1`, `px-1`, `gap-1`, `mt-1`, `space-y-1` | **4 px** | `gap-1` (14), `space-y-1` (12), `mt-1` (17), `px-1` (3), `p-1` (2) |
| `gap-1.5`, `p-1.5`, `px-1.5` | **6 px** | `gap-1.5` (7), `p-1.5` icône MessageBar, `px-1.5` |
| `gap-2`, `px-2`, `py-2`, `p-2`, `mt-2`, `mb-2`, `space-y-2` | **8 px** | `gap-2` (30), `py-2` (20) |
| `px-2.5`, `py-2.5` | **10 px** | badges (`px-2.5`), lignes de liste Caisse (`py-2.5`) |
| `p-3`, `px-3`, `py-3`, `gap-3`, `space-y-3`, `mt-3`, `mb-3` | **12 px** | `py-3` (40), `gap-3` (39), `px-3` (42), `p-3` (7) |
| `p-4`, `px-4`, `py-4`, `gap-4`, `space-y-4`, `mt-4`, `mb-4` | **16 px** | `px-4` (48 — padding des cellules de table), `p-4` (19 — padding des cartes) |
| `px-5`, `py-5` | **20 px** | en‑têtes/pieds de modale et drawer (`px-5`) |
| `px-6`, `py-6`, `space-y-6` | **24 px** | padding vertical de page (`py-6`), états vides (`px-6 py-12`) |
| `p-8` | **32 px** | carte d'erreur écran `ScreenErrorBoundary.jsx:35` |
| `py-10` | **40 px** | `ErrorState` (`ErrorState.jsx:12`) |
| `py-12` | **48 px** | `EmptyState` (`EmptyState.jsx:4`) |
| `pb-28` | **112 px** | réservé sous la barre de nav mobile (`Layout.jsx:139`) |
| `pb-10` (`lg:pb-10`) | **40 px** | bas de page desktop (`Layout.jsx:139`) |

Largeurs de contenu : `max-w-6xl` = **1152 px** (72 rem, `Layout.jsx:139`, `MessageBar.jsx:110`) ;
`max-w-md` = **448 px** (drawer) ; `max-w-sm` = **384 px** (toast) ; `max-h-64` = **256 px** (panneau messages) ;
`max-h-[92vh]` (modale), `h-[260px]` (zone vide Accueil).

---

## 6. Dimensions clés

| Élément | Valeur (px) | Classe | Défini dans |
| --- | --- | --- | --- |
| **Largeur du menu latéral** | **256 px** | `w-64` | `src/components/Layout.jsx:96` |
| Contre‑pied du contenu (décalage menu) | **256 px** | `lg:pl-64` | `src/components/Layout.jsx:137` |
| En‑tête du menu latéral (logo) | **64 px** | `h-16` | `src/components/Layout.jsx:97` |
| En‑tête mobile | **56 px** | `h-14` | `src/components/Layout.jsx:132` |
| **Hauteur d'un item de navigation (desktop)** | **44 px** | `min-h-11` | `src/components/Layout.jsx:108` |
| **Hauteur d'un item de navigation (mobile, barre basse)** | **56 px** | `min-h-14` | `src/components/Layout.jsx:161` |
| Icône d'item de navigation | 18 px (desktop) / 20 px (mobile) | `size={18}` / `size={20}` | `src/components/Layout.jsx:118` / `:169` |
| **Hauteur d'un bouton (standard)** | **44 px** | `min-h-11` | `src/components/Button.jsx:20` |
| Hauteur d'un bouton compact (MessageBar) | **36 px** | `h-9` | `src/components/MessageBar.jsx:30` |
| Hauteur du sélecteur de thème | **36 px** | `min-h-9` | `src/components/Layout.jsx:77` |
| Bouton icône (modale / drawer / suppression) | **44 px × 44 px** | `h-11 w-11` | `src/components/Modal.jsx:45`, `Drawer.jsx:42` |
| **Hauteur d'un champ (standard)** | **44 px** | `h-11` | `src/components/ProduitForm.jsx:27`, `CategorieManager.jsx:13`, `src/pages/Produits.jsx:225,239`, `Ventes.jsx:248…303`, `Rapport.jsx:93` |
| Hauteur du champ de recherche Caisse | **48 px** | `h-12` | `src/pages/Caisse.jsx:300` |
| Hauteur des `select` de pagination / chips de mode | **36 px** | `h-9` / `min-h-9` | `src/components/Pagination.jsx:39`, `src/pages/Caisse.jsx:653` |
| Pilules de filtre (Caisse/Ventes) | **44 px** | `min-h-11` | `src/pages/Caisse.jsx:367,381`, `Ventes.jsx:225` |
| Badge | **22 px** de haut (16 px de ligne + 2×2 px de padding + 2×1 px de bordure) | `px-2.5 py-0.5 text-xs` | `src/components/Badge.jsx:18` |

Cible tactile minimale : **44 px** (documentée dans les en‑têtes de `Button.jsx:1` et `Layout.jsx:3`).

---

## 7. Composants de base et variantes

### 7.1 Menu latéral — `src/components/Layout.jsx`

| Variante | Description | Style | Ligne |
| --- | --- | --- | --- |
| Latérale fixe | ≥ 1024 px, colonne de gauche | `w-64` (256 px), `bg-[var(--surface)]`, `border-r border-[var(--border)]` | `Layout.jsx:96` |
| En‑tête de menu | logo + nom boutique | `h-16`, `px-5`, `border-b` | `Layout.jsx:97` |
| Item inactif | libellé + icône | `min-h-11`, `rounded-lg`, `px-3`, `text-sm font-medium`, `text-[var(--muted)]`, survol `bg-[var(--surface-alt)]` | `Layout.jsx:108‑110` |
| Item actif | page courante | `text-[var(--primary)]`, fond `var(--color-primary-soft)` ≈ `#2563eb1f` | `Layout.jsx:109,113` |
| Barre mobile basse | < 1024 px, 5 colonnes | `min-h-14`, `border-t`, `bg-[var(--surface)]`, libellé `text-[11px]` | `Layout.jsx:149‑174` |
| En‑tête mobile | barre supérieure | `h-14`, `border-b`, sticky `z-30` | `Layout.jsx:132` |
| Sélecteur de thème | pilule 3 options Clair/Sombre/Auto | `rounded-full border p-1 shadow-sm`, options `min-h-9 px-3 text-xs` | `Layout.jsx:71‑86` |

### 7.2 Bouton — `src/components/Button.jsx` (`VARIANTS`, lignes 3‑10)

| Variante | Style |
| --- | --- |
| `primary` (défaut) | fond `var(--primary)` `#2563eb` / `#7aa2ff`, texte `var(--primary-contrast)`, bordure transparente, `shadow-[0_10px_20px_rgba(37,99,235,.22)]`, survol `brightness-110` |
| `secondary` | fond `var(--surface)`, texte `var(--text)`, bordure `var(--border)`, `shadow-sm`, survol `bg-[var(--surface-alt)]` |
| `danger` | fond `var(--danger)` `#dc2626` / `#f87171`, texte `var(--danger-contrast)`, `shadow-[0_10px_22px_rgba(220,38,38,.25)]` |
| `ghost` | fond transparent, texte `var(--muted)`, bordure transparente, `shadow-none`, survol `bg-[var(--surface-alt)]` |

Commun à toutes : `min-h-11` (44 px), `rounded-lg` (8 px), `px-4 py-2`, `text-sm font-semibold`,
désactivé `opacity-50`, actif `scale-[0.94]`, survol `-translate-y-0.5 shadow-xl` (`Button.jsx:20`).

Autres familles de boutons : bouton compact MessageBar `h-9 rounded-lg border … text-sm font-medium`
(`MessageBar.jsx:29‑30`), bouton icône `h-11 w-11 rounded-lg` (`Modal.jsx:45`), pilule de filtre
`min-h-11 rounded-full px-4` (`Caisse.jsx:367`).

### 7.3 Carte — motif inline (pas de composant dédié)

| Variante | Style | Exemple |
| --- | --- | --- |
| Carte standard (section/KPI) | `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm` (15 occurrences) | `src/pages/Accueil.jsx:21`, `Rapport.jsx:31,146,171`, `RapportMensuel.jsx:46,70,80,99` |
| Carte‑conteneur (tableau/liste) | `overflow-hidden rounded-2xl border border-slate-200 bg-white` | `src/pages/Produits.jsx:287`, `Ventes.jsx:352`, `ProduitForm.jsx:151` |
| Encart interne (détail, fil d'Ariane) | `rounded-xl border border-slate-200 px-3 py-2` / `rounded-xl bg-slate-50 p-3` | `src/pages/Accueil.jsx:342,369`, `Ventes.jsx:456,483` |
| Carte‑sélection (grille produits) | `rounded-xl border p-3`, sélectionnée `border-[var(--primary)]` + `bg-[var(--primary-soft)]` | `src/pages/Caisse.jsx:417` |
| Carte vide (`EmptyState`) | `rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center` | `src/components/EmptyState.jsx:4` |
| Carte d'erreur (`ErrorState`) | `rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center` (sombre : `rgba(220,38,38,.12)`) | `src/components/ErrorState.jsx:12` |
| Bannière d'alerte (`DemoBanner`) | `rounded-xl border border-amber-400 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm` | `src/components/DemoBanner.jsx:10` |
| Carte de confirmation | pas de style propre : réutilise `Modal` + `Button` `secondary` / `danger` | `src/components/ConfirmDialog.jsx:19‑36` |

### 7.4 Tableau

| Variante | Style | Exemple |
| --- | --- | --- |
| Standard | conteneur `overflow-hidden rounded-2xl border border-slate-200 bg-white` + `table.w-full.text-left.text-sm` | `src/pages/Produits.jsx:287‑289`, `Ventes.jsx:352‑354` |
| En‑tête | `border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500`, cellules `px-4 py-3` | `src/pages/Produits.jsx:290‑301` |
| Cellules corps | `px-4 py-3`, séparateur `divide-y divide-slate-100`, survol `background-color: var(--surface-alt)` | `src/pages/Produits.jsx:303+`, `src/index.css:176‑182` |
| Compact (Caisse) | conteneur `overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`, cellules `px-3 py-2` | `src/pages/Caisse.jsx:310` |
| En chargement (skeleton) | même conteneur + `RowSkeleton` × 4/5 | `src/pages/Produits.jsx:255‑264`, `Ventes.jsx:324` |
| Impression (ticket) | `.ticket-table` exclue du survol thématisé ; fond blanc / texte noir | `src/index.css:175‑176`, `src/components/Ticket.css` |
| Formulaires lignes (produit) | `w-full min-w-[48rem] text-left text-sm` | `src/components/ProduitForm.jsx:403` |

### 7.5 Badge — `src/components/Badge.jsx` (`TONES`, lignes 3‑9)

Base commune : `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold`
(`Badge.jsx:18`), survol `translateY(-1px) scale(1.02)` (`src/index.css:309‑312`).
Couleurs définies dans **`src/index.css:314‑372`**.

| Variante (`tone`) | Fond clair | Texte clair | Bordure clair | Fond sombre | Texte sombre | Bordure sombre |
| --- | --- | --- | --- | --- | --- | --- |
| `slate` (défaut) | `#f1f5f9f5` (`rgba(241,245,249,.96)`) | `#475569` | `#94a3b859` (`rgba(148,163,184,.35)`) | `#47556952` (`rgba(71,85,105,.32)`) | `#e2e8f0` | `#94a3b86b` (`rgba(148,163,184,.42)`) |
| `green` | `#dcfce7f5` (`rgba(220,252,231,.96)`) | `#15803d` | `#22c55e40` (`rgba(34,197,94,.25)`) | `#14532d6b` (`rgba(20,83,45,.42)`) | `#bbf7d0` | `#22c55e6b` (`rgba(34,197,94,.42)`) |
| `blue` | `#dbeafef5` (`rgba(219,234,254,.96)`) | `#1d4ed8` | `#3b82f64d` (`rgba(59,130,246,.3)`) | `#1e40af59` (`rgba(30,64,175,.35)`) | `#bfdbfe` | `#60a5fa80` (`rgba(96,165,250,.5)`) |
| `orange` | `#ffedd5f5` (`rgba(255,237,213,.96)`) | `#c2410c` | `#fb923c57` (`rgba(251,146,60,.34)`) | `#92400e61` (`rgba(146,64,14,.38)`) | `#fed7aa` | `#fb923c7a` (`rgba(251,146,60,.48)`) |
| `red` | `#fee2eef2` (`rgba(254,226,226,.95)`) | `#b91c1c` | `#ef444447` (`rgba(239,68,68,.28)`) | `#7f1d1d6b` (`rgba(127,29,29,.42)`) | `#fecaca` | `#f871717a` (`rgba(248,113,113,.48)`) |

Variante apparentée : pilule de filtre `rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600`
(`src/pages/Produits.jsx`, `Caisse.jsx`).

### 7.6 Barre de messages — `src/components/MessageBar.jsx` (`NIVEAUX`, lignes 22‑27)

Structure : bandeau `border-b-2 border-[var(--border)] bg-[var(--surface-alt)]`, fond teinté
`color-mix(in srgb, <couleur> 15%, var(--surface))`, liseré gauche `5px solid <couleur>`,
contenu `mx-auto max-w-6xl gap-2 px-3 py-2.5` (`MessageBar.jsx:91‑110`).

| Variante (`niveau`) | Couleur | Icône | Ligne |
| --- | --- | --- | --- |
| `critique` | `var(--danger)` — `#dc2626` / `#f87171` | `OctagonAlert` | `MessageBar.jsx:23` |
| `avertissement` | `var(--warning)` — `#d97706` / `#fbbf24` | `AlertTriangle` | `MessageBar.jsx:24` |
| `succes` | `var(--success)` — `#16a34a` / `#22c55e` | `CheckCircle2` | `MessageBar.jsx:25` |
| `info` | `var(--primary)` — `#2563eb` / `#7aa2ff` | `Info` | `MessageBar.jsx:26` |

Sous‑éléments : pastille d'icône `rounded-full p-1.5` avec fond `color-mix(… 25%, var(--surface))`
(`:112‑113`) ; étiquette de niveau `rounded-full border px-2.5 py-0.5 text-[11px] font-bold` sur fond
`color-mix(… 22%, var(--surface))` (`:121‑125`) ; boutons de navigation `h-9 min-w-9 rounded-lg border … text-sm`
(`:29‑30`) ; panneau déplié `max-h-64`, lignes `px-1 py-2.5` (`:193‑206`).

Variante jumelle (toast) : `src/components/Toast.jsx:43` — `rounded-xl px-4 py-3 shadow-lg ring-1`,
`bg-red-600 text-white ring-red-700` (erreur) / `bg-emerald-700 text-white ring-emerald-700` (succès).

---

## 8. Durées et courbes (bonus, définies dans `src/index.css:23‑27`)

| Jeton | Valeur | Référence |
| --- | --- | --- |
| `--motion-duration-fast` | `150 ms` | `src/index.css:24` (déclarée) |
| `--motion-duration` | `180 ms` | `src/index.css:23` (déclarée) |
| `--motion-duration-slow` | `260 ms` | `src/index.css:25` (déclarée) |
| `--ease-standard` | `cubic-bezier(0.22, 1, 0.36, 1)` | `src/index.css:26` (valeur reprise en littéral dans les animations) |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | `src/index.css:27`, utilisé `src/index.css:177` |
| Transitions interactives | `200 ms cubic-bezier(.22,1,.36,1)` | `src/index.css:213‑218` |
| Durée de transition Tailwind par défaut | `150 ms` (`--default-transition-duration`) | thème Tailwind |

> Vérification : `npm run build` puis lecture de `dist/assets/index-*.css`
> (`--spacing:.25rem`, `--radius-lg:.5rem`, `--radius-xl:.75rem`, `--radius-2xl:1rem`,
> `--text-sm:.875rem`, etc.).
