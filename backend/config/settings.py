
from pathlib import Path
import environ

# ============================================================
# CHEMIN PRINCIPAL DU PROJET
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent


# ============================================================
# CHARGEMENT DU FICHIER .ENV
# ============================================================

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")


# ============================================================
# SÉCURITÉ ET CONFIGURATION GÉNÉRALE
# ============================================================

SECRET_KEY = env("DJANGO_SECRET_KEY")

DEBUG = env.bool("DJANGO_DEBUG", default=False)

ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1"]
)

CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=[]
)


# ============================================================
# APPLICATIONS INSTALLÉES
# ============================================================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Applications supplémentaires
    "rest_framework",
    "commerce",
]


# ============================================================
# MIDDLEWARES
# ============================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ============================================================
# CONFIGURATION DU CADRICIEL REST
# ============================================================

REST_FRAMEWORK = {
    # Enveloppe {count, next, previous, results} — page_size = 10
    "DEFAULT_PAGINATION_CLASS": "commerce.pagination.PaginationParPage",
    "PAGE_SIZE": 10,
    # Les dates sont rendues en ISO 8601, les Decimal en chaînes
    "DATETIME_FORMAT": "iso-8601",
    "COERCE_DECIMAL_TO_STRING": True,
}


# ============================================================
# CONFIGURATION DES URLS
# ============================================================

ROOT_URLCONF = "config.urls"


# ============================================================
# CONFIGURATION DES TEMPLATES
# ============================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ============================================================
# CONFIGURATION WSGI
# ============================================================

WSGI_APPLICATION = "config.wsgi.application"


# ============================================================
# CONFIGURATION DE LA BASE DE DONNÉES MYSQL
# ============================================================

DATABASES = {
    "default": {
        "ENGINE": env("DB_ENGINE", default="django.db.backends.mysql"),

        "NAME": env("DB_NAME"),
        "USER": env("DB_USER", default=""),
        "PASSWORD": env("DB_PASSWORD", default=""),
        "HOST": env("DB_HOST", default=""),
        "PORT": env.int("DB_PORT", default=0),

        "OPTIONS": {
            "charset": "utf8mb4",

            # Activation du mode strict MySQL
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# Connexion par socket UNIX (DB_SOCKET=/chemin/mysql.sock) : si renseigné,
# HOST et PORT sont ignorés. Sert quand MySQL n'écoute pas en TCP local.
_db_socket = env("DB_SOCKET", default="")
if _db_socket:
    DATABASES["default"]["HOST"] = ""
    DATABASES["default"]["PORT"] = 0
    DATABASES["default"]["OPTIONS"]["unix_socket"] = _db_socket


# ============================================================
# VALIDATION DES MOTS DE PASSE
# ============================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# ============================================================
# LANGUE ET FUSEAU HORAIRE
# ============================================================

LANGUAGE_CODE = "fr-fr"

TIME_ZONE = "Africa/Dakar"

USE_I18N = True

USE_TZ = True


# ============================================================
# FICHIERS STATIQUES
# ============================================================

STATIC_URL = "static/"


# ============================================================
# CLÉ PRIMAIRE PAR DÉFAUT
# ============================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
