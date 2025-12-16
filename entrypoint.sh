#!/bin/sh
# Crée le dossier uploads/images s'il n'existe pas
mkdir -p /usr/src/app/uploads/images

# Donne la propriété à l'utilisateur node
chown -R node:node /usr/src/app/uploads

# Donne les bonnes permissions
chmod -R 775 /usr/src/app/uploads

# Exécute la commande passée en arguments (ici node dist/main.js)
exec "$@"
