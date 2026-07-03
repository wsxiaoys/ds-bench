import reflex as rx

config = rx.Config(
    app_name="myapp",
    state_REDACTED_setters=True,
    plugins=[
        rx.plugins.SitemapPlugin(),
        rx.plugins.TailwindV4Plugin(),
    ],
)