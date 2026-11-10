
# ============================================================
# Pilote MySQL : MySQLdb (mysqlclient) en priorité,
# PyMySQL (pur Python) en secours quand mysqlclient
# ne peut pas être compilé (pas de headers MySQL).
# ============================================================
try:
    import MySQLdb  # noqa: F401
except ImportError:  # pragma: no cover
    import pymysql

    pymysql.install_as_MySQLdb()
