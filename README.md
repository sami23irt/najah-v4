# Najah.ma

**Najah.ma** est une plateforme éducative marocaine conçue pour aider les élèves à organiser leurs révisions, accéder aux archives d’examens, suivre leur progression et étudier seuls ou en groupe.


## Présentation

Najah.ma propose un espace de révision personnalisé dans lequel l’élève peut créer son compte, choisir son niveau et sa filière, consulter des ressources adaptées et suivre ses sessions d’étude ainsi que ses résultats.

La plateforme inclut également un espace d’étude permettant d’importer un document PDF ou un lien YouTube. Le contenu importé peut ensuite être utilisé pour produire un résumé, poser des questions à un assistant pédagogique lié au support et générer un questionnaire à choix multiple.

Les élèves peuvent aussi rejoindre des salles d’étude collaboratives avec audio et vidéo, discussion, minuteur partagé et tableau blanc interactif.

## Fonctionnalités principales

| Domaine | Fonctionnalités |
|---|---|
| Comptes | Inscription par e-mail, vérification de l’adresse, connexion avec Google et gestion du compte. |
| Révision | Choix du niveau et de la filière, sessions d’étude, tableau de progression et historique des tentatives. |
| Archives | Consultation des examens publiés avec filtrage par niveau et matière. |
| Espace d’étude | Import de PDF ou de vidéos YouTube, extraction de texte, résumé, assistant lié au support et génération de QCM. |
| Travail en groupe | Salles ouvertes ou privées, gestion des membres, audio/vidéo LiveKit, discussion, minuteur et tableau blanc. |
| Protection des données | Supabase Auth, PostgreSQL, Row-Level Security, journaux d’audit et vérification côté serveur des opérations sensibles. |

## Architecture technique

Le projet est une application web construite avec **Next.js App Router**, **React** et **TypeScript**. **Supabase** fournit l’authentification, la base PostgreSQL, le stockage privé et les fonctionnalités Realtime. **pgvector** est utilisé pour la recherche sémantique dans les contenus pédagogiques.

Les salles audio et vidéo utilisent **LiveKit**. Certaines fonctions pédagogiques, comme l’assistant, le résumé et la génération de QCM, utilisent **Gemini** côté serveur. Dans cette architecture, l’IA est donc un service intégré à l’application et non le créateur du produit.

| Couche | Technologie |
|---|---|
| Interface et serveur | Next.js, React, TypeScript |
| Authentification et données | Supabase Auth, PostgreSQL, Supabase Storage, Supabase Realtime |
| Recherche sémantique | pgvector et pipeline RAG côté serveur |
| Audio et vidéo | LiveKit Server SDK et LiveKit Client |
| Validation des entrées | Zod dans les routes API |
| Observabilité et e-mails | Sentry, PostHog et Resend |

## Installation locale

Prérequis : Node.js, npm et un projet Supabase.

```bash
npm install
npm run dev
```

أنشئ ملف `.env.local` محلياً وأضف متغيرات البيئة المطلوبة الموضحة أدناه. لا ترفع هذا الملف إلى Git.

L’application est ensuite disponible à l’adresse [http://localhost:3000](http://localhost:3000).

Pour activer l’authentification et les données réelles, renseignez les variables Supabase dans `.env.local`. Les fonctionnalités audio/vidéo nécessitent également une configuration LiveKit.

## Variables d’environnement

Créez un fichier `.env.local` uniquement sur votre machine, puis renseignez les variables suivantes avec vos propres valeurs :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
GEMINI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

Ne commitez jamais `.env.local` ni une clé secrète dans Git. La clé `NEXT_PUBLIC_SUPABASE_ANON_KEY` est une clé publique destinée au navigateur. Les clés `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` et `RESEND_API_KEY` doivent rester exclusivement côté serveur.

## Base de données et migrations

Les migrations Supabase se trouvent dans `supabase/migrations/`. Appliquez-les avec les outils officiels Supabase ou dans l’environnement de déploiement prévu. Examinez toujours une migration et sauvegardez la base avant de la déployer en production.

Les définitions de tables et de types utilisées par Drizzle se trouvent dans `drizzle/schema.ts`. Toute modification de structure doit garder les définitions Drizzle et les migrations SQL cohérentes.

## Sécurité

Les opérations sensibles sont protégées par une authentification côté serveur et les données utilisateur sont isolées par des politiques **Row-Level Security**. Les routes API valident les entrées avec Zod, les résultats des QCM sont calculés côté serveur et les fichiers PDF sont contrôlés avant leur traitement.

Le projet comprend également des en-têtes de sécurité, des cookies de session configurés pour le serveur, une limitation du débit sur les routes sensibles, des réponses API réduites et des liens de stockage temporaires pour les fichiers privés.

Les paramètres de production doivent toutefois être configurés correctement dans Supabase, LiveKit et le fournisseur de déploiement. Les clés qui auraient déjà été exposées doivent être révoquées et remplacées.

## Commandes utiles

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:push
npm run ingest
```

La commande `npm run ingest` sert à alimenter la base de connaissances après préparation des textes, selon le script `scripts/ingest-curriculum.ts`.

## Organisation du projet

```text
app/                  Pages Next.js et routes API
components/           Composants d’interface et de salles
lib/                  Clients Supabase et services d’étude, RAG et observabilité
drizzle/              Définitions des tables et des types
supabase/migrations/  Migrations SQL et politiques RLS
scripts/              Outils d’ingestion et de maintenance
public/               Ressources statiques légères de l’interface
```

## État du projet

Najah.ma est un projet en cours de développement. Avant une ouverture publique, il est recommandé de finaliser la configuration de l’authentification et des e-mails, d’ajouter une protection anti-robot et une limitation distribuée des tentatives de connexion, de mettre à jour les dépendances, de valider le build dans une CI et de revoir les exigences de confidentialité liées aux données des élèves.
