# Generated by Django 4.0.7 on 2022-10-03 12:10

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("pigame", "0001_initial"),
        ("piplayer", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="gameconfig",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="pigame.gameconfig"),
        ),
    ]
