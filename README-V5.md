# Najah.ma — version française v5

Cette version conserve l’identité visuelle validée : vert émeraude, doré, cartes arrondies et motifs marocains subtils.

## Parcours ajouté

L’élève peut créer un compte avec son adresse e-mail, recevoir le lien de vérification, choisir son niveau et sa filière, puis entrer dans son espace de révision. Les archives sont filtrées par niveau et filière. La page de séance propose l’import d’un PDF ou d’un lien YouTube, un résumé, un assistant lié au support et un quiz généré à partir du contenu.

## Lancement local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Pour activer la vraie authentification et les données, renseignez les variables Supabase dans `.env.local`. Supabase Auth envoie les e-mails de vérification lorsque l’inscription par e-mail est activée. Pour l’envoi de courriels de production, configurez également un domaine vérifié dans votre fournisseur SMTP ou dans Resend.

## Important

Cette archive est une version de prévisualisation locale. Aucun fichier du dépôt GitHub principal n’a été modifié.
