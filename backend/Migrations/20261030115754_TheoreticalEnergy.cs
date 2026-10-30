using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Energy.Api.Migrations
{
    /// <inheritdoc />
    public partial class TheoreticalEnergy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AnnualEnergyMedium",
                table: "Nodes",
                type: "text",
                nullable: false,
                defaultValue: "Electricity");

            migrationBuilder.AddColumn<string>(
                name: "AnnualEnergyUnit",
                table: "Nodes",
                type: "text",
                nullable: false,
                defaultValue: "kWh");

            migrationBuilder.AddColumn<decimal>(
                name: "AnnualEnergyValue",
                table: "Nodes",
                type: "numeric(24,6)",
                precision: 24,
                scale: 6,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnnualEnergyMedium",
                table: "Nodes");

            migrationBuilder.DropColumn(
                name: "AnnualEnergyUnit",
                table: "Nodes");

            migrationBuilder.DropColumn(
                name: "AnnualEnergyValue",
                table: "Nodes");
        }
    }
}
