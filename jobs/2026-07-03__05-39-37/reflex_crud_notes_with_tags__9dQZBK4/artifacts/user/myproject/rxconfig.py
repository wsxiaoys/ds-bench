import reflex as rx

config = rx.Config(
    app_name="myproject",
    db_url="sqlite:////home/user/myproject/reflex.db",
    plugins=[
        rx.plugins.SitemapPlugin(),
        rx.plugins.TailwindV4Plugin(),
    ],
)