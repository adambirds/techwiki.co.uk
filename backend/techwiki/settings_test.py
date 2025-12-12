from .settings import *  # noqa: F403 isort: skip

LOGGING = {
    "version": 1,
    "disable_existing_loggers": True,
    "handlers": {
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {
        "handlers": ["null"],
        "level": "DEBUG",
    },
    "loggers": {
        "django": {"handlers": ["null"], "level": "DEBUG", "propagate": False},
    },
}
