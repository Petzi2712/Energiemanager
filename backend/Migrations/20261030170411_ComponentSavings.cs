using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Energy.Api.Migrations
{
    /// <inheritdoc />
    public partial class ComponentSavings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "SavingsPercent",
                table: "Nodes",
                type: "numeric(24,6)",
                precision: 24,
                scale: 6,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SavingsPercent",
                table: "Nodes");
        }
    }
}
