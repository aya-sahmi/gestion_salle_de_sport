# Salle Sport

Application de bureau Windows hors ligne pour le suivi d'une salle de sport et de ses encaissements.

## Prérequis

- Node.js 22 ou ultérieur
- npm
- Windows avec les outils de compilation pris en charge par `better-sqlite3` si aucun binaire Electron précompilé n'est disponible

## Développement

```powershell
npm install
npm run electron:dev
```

Le script `postinstall` reconstruit `better-sqlite3` pour la version d'Electron du projet. Pour vérifier les sources :

```powershell
npm run build
npm run lint
npm test
```

Les tests utilisent le runtime Node fourni par Electron afin d'utiliser le même ABI natif SQLite que l'application.

## Création de l'installateur Windows

```powershell
npm run dist:win
```

L'installateur NSIS est créé dans `release/`. Il ajoute un raccourci au menu Démarrer et, par défaut, un raccourci sur le bureau. La base n'est pas stockée dans le dossier d'installation : elle est créée dans le répertoire `userData` géré par Electron et est conservée lors des mises à jour.

## Données et règles financières

- SQLite utilise les clés étrangères et le mode WAL.
- Les paiements et leurs mois sont validés dans une transaction, avec un index unique qui interdit deux règlements actifs du même mois pour une inscription.
- Les montants sont stockés en centimes de dirham (MAD). Une discipline peut être choisie directement lors de la création d'un athlète, ce qui crée aussi son inscription. Pour le judo, une catégorie à 100 DHS ou 120 DHS par mois est alors choisie et son tarif est conservé dans l'historique. Les autres disciplines utilisent le tarif configuré dans Paramètres.
- Les annulations gardent le paiement et le reçu dans l'historique, et libèrent les mois concernés pour une correction ultérieure.
- Les sauvegardes passent par l'API de sauvegarde SQLite, et les restaurations vérifient l'intégrité avant confirmation.
- Le renderer n'accède ni à Node.js ni à SQLite. Il utilise uniquement les méthodes explicitement exposées par le preload sécurisé.

Configurez le nom, les coordonnées de la salle et les tarifs avant de créer des inscriptions et d'enregistrer des paiements.
