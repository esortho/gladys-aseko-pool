# Intégration ASEKO Pool

Cette intégration externe lit l'état des équipements de piscine via l'API publique ACS d'ASEKO. Elle est en lecture seule : elle n'allume ni n'éteint la pompe de filtration et n'envoie aucune commande aux équipements ASEKO.

## Configuration

1. Créez une clé API dans les paramètres de votre compte ASEKO : https://account.aseko.cloud/profile/settings/api-keys.
2. Acceptez les conditions d'utilisation ASEKO en vigueur.
3. Installez ASEKO Pool sur Gladys Assistant 5.1.0 ou ultérieur.
4. Saisissez la clé dans le champ Clé API ASEKO. Gladys conserve ce champ comme secret.
5. Choisissez un intervalle d'actualisation (60 à 3600 secondes ; 300 par défaut), enregistrez puis recherchez les appareils.

L'intégration découvre les unités associées à votre compte ASEKO. Elle n'ajoute que les mesures que l'API indique comme disponibles pour chaque unité. L'état de la pompe/filtration, les températures, le pH, le redox, la pression, le niveau d'eau, la chimie de l'eau, le mode de fonctionnement et les messages d'état sont accessibles si l'unité les fournit. Les valeurs absentes ou nulles ne sont pas publiées.

## Dépannage

- 401 Unauthorized : vérifiez la clé API et sa validité.
- 403 Forbidden : acceptez les conditions d'utilisation ASEKO ; l'accès API peut aussi dépendre de votre offre.
- 429 Too Many Requests : augmentez l'intervalle d'actualisation et réessayez plus tard.
- Aucun appareil ou aucune mesure : vérifiez que l'unité est associée dans ASEKO Cloud et qu'elle a transmis des données.

L'intégration utilise uniquement des requêtes HTTPS GET vers https://api.aseko.cloud/api/v1. La clé API n'est jamais écrite dans les journaux.

Documentation API : https://api.aseko.cloud/api/v1/docs.
